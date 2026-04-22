import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import axios from "axios";
import PDFDocument from "pdfkit";
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function initializeAdmin() {
  if (getApps().length) return;

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawServiceAccount) {
    initializeApp({
      credential: cert(JSON.parse(rawServiceAccount)),
    });
    return;
  }

  initializeApp({
    credential: applicationDefault(),
  });
}

initializeAdmin();
const adminDb = getFirestore();
const adminAuth = getAuth();

function getCompanySettingsDocId(kind: 'shop' | 'communication', companyId?: string | null) {
  return `${kind}_${companyId || 'global'}`;
}

async function requireRequestContext(req: express.Request) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) {
    const error = new Error('Authentication required');
    (error as any).status = 401;
    throw error;
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const profileSnap = await adminDb.collection('profiles').doc(decoded.uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : null;
  if (!profile?.company_id) {
    const error = new Error('User profile or company workspace not found');
    (error as any).status = 403;
    throw error;
  }

  return {
    uid: decoded.uid,
    email: decoded.email || null,
    profile,
    companyId: String(profile.company_id),
    isAdmin: profile.role === 'owner' || profile.role === 'admin',
  };
}

function requireSameCompany(ctx: Awaited<ReturnType<typeof requireRequestContext>>, requestedCompanyId?: string | null) {
  if (requestedCompanyId && requestedCompanyId !== ctx.companyId) {
    const error = new Error('Requested company does not match authenticated workspace');
    (error as any).status = 403;
    throw error;
  }
}

function hasServerPermission(ctx: Awaited<ReturnType<typeof requireRequestContext>>, permission: string) {
  if (ctx.isAdmin) return true;
  return Array.isArray(ctx.profile.permissions) && ctx.profile.permissions.includes(permission);
}

function requireAnyPermission(ctx: Awaited<ReturnType<typeof requireRequestContext>>, permissions: string[]) {
  if (permissions.some((permission) => hasServerPermission(ctx, permission))) return;

  const error = new Error('You do not have permission to perform this action');
  (error as any).status = 403;
  throw error;
}

function isSafeHttpUrl(rawUrl?: string | null) {
  if (!rawUrl) return false;

  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === 'metadata.google.internal' ||
      host === '0.0.0.0' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host) ||
      host === '::1' ||
      host === '[::1]'
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function requireSale(ctx: Awaited<ReturnType<typeof requireRequestContext>>, saleId: string) {
  const saleSnap = await adminDb.collection('sales').doc(saleId).get();
  if (!saleSnap.exists) {
    const error = new Error('Sale not found');
    (error as any).status = 404;
    throw error;
  }

  const sale = saleSnap.data() as any;
  if (sale.company_id !== ctx.companyId) {
    const error = new Error('Sale does not belong to this company workspace');
    (error as any).status = 403;
    throw error;
  }

  return sale;
}

async function findInviteByToken(token: string) {
  if (!token || token.length < 20) {
    const error = new Error('Invite not found');
    (error as any).status = 404;
    throw error;
  }

  const inviteSnap = await adminDb.collection('staff_invites')
    .where('token', '==', token)
    .limit(1)
    .get();

  if (inviteSnap.empty) {
    const error = new Error('Invite not found');
    (error as any).status = 404;
    throw error;
  }

  const inviteDoc = inviteSnap.docs[0];
  return {
    ref: inviteDoc.ref,
    id: inviteDoc.id,
    data: inviteDoc.data() as any,
  };
}

function sendApiError(res: express.Response, error: any) {
  const status = Number(error?.status || 500);
  const message = status >= 500 ? 'Server error' : error.message;
  if (status >= 500) {
    console.error(error);
  }
  res.status(status).json({ error: message });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get("/api/staff-invites/resolve", async (req, res) => {
    try {
      const token = String(req.query.token || '').trim();
      const invite = await findInviteByToken(token);
      const data = invite.data;

      res.json({
        invite: {
          id: invite.id,
          email: data.email || null,
          full_name: data.full_name || null,
          role: data.role || 'staff',
          branch: data.branch || null,
          title: data.title || null,
          status: data.status || 'active',
          expires_at: data.expires_at || null,
          accepted_at: data.accepted_at || null,
        },
      });
    } catch (error: any) {
      sendApiError(res, error);
    }
  });

  app.post("/api/staff-invites/activate", async (req, res) => {
    try {
      const token = String(req.body?.token || '').trim();
      const tempPassword = String(req.body?.tempPassword || '');
      const password = String(req.body?.password || '');

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const invite = await findInviteByToken(token);
      const data = invite.data;

      if (data.accepted_at) {
        return res.status(409).json({ error: 'This invite has already been used.' });
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return res.status(410).json({ error: 'This invite has expired. Please ask an admin to send a new one.' });
      }

      if (!data.company_id || !data.email || tempPassword !== data.temp_password) {
        return res.status(403).json({ error: 'The invite credentials are invalid.' });
      }

      const userRecord = await adminAuth.createUser({
        email: String(data.email),
        password,
        displayName: data.full_name || undefined,
        disabled: false,
      });

      const now = new Date().toISOString();
      const canonicalProfilePayload = {
        full_name: data.full_name || 'Staff Member',
        role: data.role || 'staff',
        company_id: data.company_id,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        email: data.email,
        branch: data.branch || null,
        title: data.title || null,
        phone: data.phone || null,
        status: data.status || 'active',
        auth_uid: userRecord.uid,
        invite_accepted_at: now,
        updated_at: now,
      };

      const uidProfileRef = adminDb.collection('profiles').doc(userRecord.uid);

      try {
        await adminDb.runTransaction(async (transaction) => {
          const freshInvite = await transaction.get(invite.ref);
          const freshData = freshInvite.data() as any;

          if (!freshInvite.exists || freshData.accepted_at) {
            throw Object.assign(new Error('This invite has already been used.'), { status: 409 });
          }

          if (freshData.temp_password !== tempPassword || freshData.company_id !== data.company_id || freshData.email !== data.email) {
            throw Object.assign(new Error('The invite credentials are invalid.'), { status: 403 });
          }

          if (data.profile_id) {
            const profileRef = adminDb.collection('profiles').doc(String(data.profile_id));
            transaction.set(profileRef, canonicalProfilePayload, { merge: true });
          }

          transaction.set(uidProfileRef, {
            ...canonicalProfilePayload,
            created_at: now,
          }, { merge: true });

          transaction.update(invite.ref, {
            accepted_at: now,
            auth_uid: userRecord.uid,
          });
        });
      } catch (transactionError) {
        await adminAuth.deleteUser(userRecord.uid).catch(() => undefined);
        throw transactionError;
      }

      res.json({
        success: true,
        email: data.email,
      });
    } catch (error: any) {
      if (error?.code === 'auth/email-already-exists') {
        return res.status(409).json({ error: 'An account already exists for this email. Ask an admin to resend or reset access.' });
      }

      sendApiError(res, error);
    }
  });

  // PDF Generation Route
  app.get("/api/invoices/:id.pdf", async (req, res) => {
    const { id } = req.params;
    const compact = String(req.query.compact || '') === '1';
    
    try {
      const ctx = await requireRequestContext(req);
      requireAnyPermission(ctx, ['invoices.view']);
      const sale = await requireSale(ctx, id);
      
      // Fetch Shop Settings
      const shopSnap = await adminDb.collection('settings').doc(getCompanySettingsDocId('shop', ctx.companyId)).get();
      const shop = shopSnap.exists ? shopSnap.data() as any : {
        name: 'AppleBerry Care Centre',
        address: '123 Repair Street, Tech City',
        phone: '+1 234 567 890',
        email: 'info@appleberry.co.za',
        website: 'www.appleberry.co.za'
      };
      
      // Fetch Customer Data
      let customer: any = null;
      if (sale.customer_id) {
        const custSnap = await adminDb.collection('customers').doc(sale.customer_id).get();
        if (custSnap.exists && custSnap.data()?.company_id === ctx.companyId) {
          customer = custSnap.data();
        }
      }
      
      // Fetch Items
      const itemsSnap = await adminDb.collection(`sales/${id}/items`).where('company_id', '==', ctx.companyId).get();
      const items = await Promise.all(itemsSnap.docs.map(async (itemDoc) => {
        const data = itemDoc.data();
        // If name is missing, try to fetch it from products collection
        if (!data.name && data.product_id) {
          try {
            const productSnap = await adminDb.collection('products').doc(data.product_id).get();
            if (productSnap.exists && productSnap.data()?.company_id === ctx.companyId) {
              return { ...data, name: productSnap.data()?.name };
            }
          } catch (e) {
            console.warn(`Failed to fetch product name for ${data.product_id}:`, e);
          }
        }
        return data;
      }));
      // Create PDF
      const pageSize = compact ? 'A5' : 'A4';
      const margin = compact ? 28 : 50;
      const docPDF = new PDFDocument({ margin, size: pageSize });
      const left = compact ? 28 : 50;
      const rightColumn = compact ? 360 : 400;
      const footerY = compact ? 540 : 720;
      const tableRightPriceX = compact ? 250 : 350;
      const tableRightTotalX = compact ? 320 : 450;
      const tableQtyX = compact ? 215 : 300;
      const descWidth = compact ? 150 : 240;
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=Invoice_${id.slice(0, 8)}.pdf`);
      
      docPDF.pipe(res);

      // Shop Info & Logo
      if (shop.logoUrl && isSafeHttpUrl(shop.logoUrl)) {
        try {
          const logoResponse = await axios.get(shop.logoUrl, { 
            responseType: 'arraybuffer',
            timeout: 5000,
            maxContentLength: 2 * 1024 * 1024,
          });
          docPDF.image(logoResponse.data, left, compact ? 32 : 45, { width: compact ? 42 : 60 });
        } catch (e) {
          console.warn("Logo fetch failed, using text fallback:", e);
          docPDF.fontSize(compact ? 18 : 25).fillColor('#9333ea').text(shop.name.charAt(0), left, compact ? 32 : 45);
        }
      } else {
        docPDF.fontSize(compact ? 18 : 25).fillColor('#9333ea').text(shop.name.charAt(0), left, compact ? 32 : 45);
      }

      docPDF.fillColor('#1e293b').fontSize(compact ? 16 : 20).text('INVOICE', rightColumn, compact ? 38 : 50, { align: 'right' });
      
      docPDF.fontSize(compact ? 8.5 : 10).fillColor('#64748b').text(shop.name, left, compact ? 88 : 110);
      docPDF.text(shop.address || '');
      docPDF.text(`Phone: ${shop.phone || ''}`);
      docPDF.text(`Email: ${shop.email || ''}`);
      if (shop.website) docPDF.text(shop.website);
      
      // Invoice Details (Fixed position on the right)
      docPDF.fillColor('#1e293b').text(`Invoice #: ${id.slice(0, 8)}`, rightColumn, compact ? 88 : 110, { align: 'right' });
      docPDF.text(`Date: ${sale.created_at ? new Date(sale.created_at).toLocaleDateString() : new Date().toLocaleDateString()}`, rightColumn, compact ? 100 : 125, { align: 'right' });
      
      // Customer Info (Dynamic position based on shop info height)
      const customerInfoY = Math.max(docPDF.y + (compact ? 16 : 20), compact ? 132 : 180);
      docPDF.fontSize(compact ? 10 : 12).fillColor('#1e293b').text('BILL TO:', left, customerInfoY);
      docPDF.fontSize(compact ? 8.5 : 10).fillColor('#475569').text(customer?.name || 'Walk-in Customer');
      if (customer?.phone) docPDF.text(customer.phone);
      if (customer?.email) docPDF.text(customer.email);
      
      // Table Header (Dynamic position)
      const tableTop = Math.max(docPDF.y + (compact ? 20 : 30), compact ? 190 : 260);
      docPDF.fillColor('#1e293b').fontSize(compact ? 8.5 : 10).text('Description', left, tableTop);
      docPDF.text('Qty', tableQtyX, tableTop, { width: compact ? 28 : 50, align: 'center' });
      docPDF.text('Price', tableRightPriceX, tableTop, { width: compact ? 58 : 100, align: 'right' });
      docPDF.text('Total', tableRightTotalX, tableTop, { width: compact ? 58 : 100, align: 'right' });
      
      docPDF.moveTo(left, tableTop + (compact ? 11 : 15)).lineTo(compact ? 392 : 550, tableTop + (compact ? 11 : 15)).strokeColor('#e2e8f0').stroke();
      
      // Items
      let currentY = tableTop + (compact ? 18 : 25);
      if (items.length > 0) {
        items.forEach(item => {
          const name = item.name || 'Unknown Item';
          const qty = Number(item.quantity) || 0;
          const price = Number(item.unit_price) || 0;
          const total = Number(item.total_price) || (qty * price);

          docPDF.fillColor('#475569').fontSize(compact ? 8.5 : 10).text(name, left, currentY, { width: descWidth });
          docPDF.text(qty.toString(), tableQtyX, currentY, { width: compact ? 28 : 50, align: 'center' });
          docPDF.text(`R ${price.toFixed(2)}`, tableRightPriceX, currentY, { width: compact ? 58 : 100, align: 'right' });
          docPDF.text(`R ${total.toFixed(2)}`, tableRightTotalX, currentY, { width: compact ? 58 : 100, align: 'right' });
          currentY += compact ? 18 : 25;
        });
      } else {
        docPDF.fillColor('#94a3b8').fontSize(compact ? 8.5 : 10).text('No items found for this sale.', left, currentY);
        currentY += compact ? 18 : 25;
      }
      
      docPDF.moveTo(left, currentY).lineTo(compact ? 392 : 550, currentY).strokeColor('#e2e8f0').stroke();
      
      // Totals
      currentY += compact ? 14 : 20;
      const totalAmount = Number(sale.total_amount) || 0;
      docPDF.fillColor('#1e293b').fontSize(compact ? 10 : 12).text('Grand Total:', tableRightPriceX, currentY, { width: compact ? 58 : 100, align: 'right' });
      docPDF.fontSize(compact ? 11 : 14).text(`R ${totalAmount.toFixed(2)}`, tableRightTotalX, currentY, { width: compact ? 58 : 100, align: 'right' });
      
      // Footer
      docPDF.fontSize(compact ? 7.5 : 10).fillColor('#94a3b8').text('Thank you for your business!', left, footerY, { align: 'center', width: compact ? 340 : 500 });
      
      docPDF.end();
      
    } catch (error: any) {
      console.error("PDF Generation error:", error);
      if (!res.headersSent) {
        res.status(Number(error?.status || 500)).send(error?.status ? error.message : 'Error generating PDF');
      }
    }
  });

  // API Routes
  app.post("/api/send-email", async (req, res) => {
    try {
      const ctx = await requireRequestContext(req);
      requireAnyPermission(ctx, ['invoices.view', 'marketing.view', 'staff.manage']);
      const { to, subject, text, html, attachments, companyId } = req.body;
      requireSameCompany(ctx, companyId);

      const savedSettingsSnap = await adminDb.collection('settings').doc(getCompanySettingsDocId('communication', ctx.companyId)).get();
      const savedSettings = savedSettingsSnap.exists ? savedSettingsSnap.data() as any : null;
      if (!savedSettings || savedSettings.company_id !== ctx.companyId || savedSettings.mode !== 'live') {
        return res.status(403).json({ error: "Messaging is currently in Test Mode. Switch to Live Mode in Communication Settings to enable outbound email." });
      }

      const settings = savedSettings.email;
      if (!settings || !settings.host || !settings.user || !settings.pass) {
        return res.status(400).json({ error: "Email settings missing" });
      }

      const transporter = nodemailer.createTransport({
        host: settings.host,
        port: parseInt(settings.port),
        secure: settings.secure,
        auth: {
          user: settings.user,
          pass: settings.pass,
        },
      });

      await transporter.sendMail({
        from: `"${settings.fromName}" <${settings.fromEmail}>`,
        to,
        subject,
        text,
        html,
        attachments: attachments?.map((a: any) => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64'),
          contentType: 'application/pdf'
        }))
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Email error:", error);
      sendApiError(res, error);
    }
  });

  app.post("/api/send-whatsapp", async (req, res) => {
    try {
      const ctx = await requireRequestContext(req);
      requireAnyPermission(ctx, ['invoices.view', 'marketing.view', 'staff.manage']);
      const { phone, message, pdfUrl, pdfBase64, pdfFilename, companyId } = req.body;
      requireSameCompany(ctx, companyId);

      const savedSettingsSnap = await adminDb.collection('settings').doc(getCompanySettingsDocId('communication', ctx.companyId)).get();
      const savedSettings = savedSettingsSnap.exists ? savedSettingsSnap.data() as any : null;
      if (!savedSettings || savedSettings.company_id !== ctx.companyId || savedSettings.mode !== 'live') {
        return res.status(403).json({ error: "Messaging is currently in Test Mode. Switch to Live Mode in Communication Settings to enable outbound WhatsApp." });
      }

      const settings = savedSettings.whatsapp;
      if (!settings) {
        return res.status(400).json({ error: "WhatsApp settings missing" });
      }

      if (settings.provider === 'unofficial') {
        if (!isSafeHttpUrl(settings.apiUrl)) {
          return res.status(400).json({ error: "WhatsApp API URL must be a public HTTP(S) endpoint." });
        }

        // Support for Instance-based APIs (like SocialPoster, UltraMsg, etc.)
        // Most of these platforms (Stackposts, WPPConnect based) prefer POST
        const isDocument = !!pdfUrl;
        const payload = {
          instance_id: settings.instanceId,
          access_token: settings.accessToken,
          token: settings.accessToken,
          to: phone,
          number: phone,
          body: message || `Here is your invoice${pdfUrl ? `: ${pdfUrl}` : ''}`,
          message: message || `Here is your invoice${pdfUrl ? `: ${pdfUrl}` : ''}`,
          caption: message || `Here is your invoice${pdfUrl ? `: ${pdfUrl}` : ''}`,
          media_url: pdfUrl, // Some use media_url
          file: pdfUrl, // Some use file
          document: pdfUrl,
          url: pdfUrl,
          filename: "Invoice.pdf",
          type: isDocument ? 'document' : 'text'
        };

        try {
          const response = await axios.post(settings.apiUrl, payload, {
            // Some APIs also accept these as query params even for POST
            params: {
              instance_id: settings.instanceId,
              access_token: settings.accessToken,
              type: isDocument ? 'document' : 'text'
            },
            timeout: 10000 // 10 second timeout
          });
          return res.json({ success: true, data: response.data });
        } catch (axiosError: any) {
          console.error("WhatsApp API Axios Error:", axiosError.response?.status || axiosError.message);
          throw new Error(axiosError.response?.data?.message || axiosError.response?.data?.error || axiosError.message || "WhatsApp API call failed");
        }
      }

      // Official Meta API
      if (!settings.phoneId) throw new Error("Phone ID missing for Official API");

      let mediaId: string | null = null;

      if (pdfBase64) {
        const formData = new FormData();
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
        formData.append('messaging_product', 'whatsapp');
        formData.append('file', pdfBlob, pdfFilename || 'Invoice.pdf');

        const mediaResponse = await axios.post(
          `https://graph.facebook.com/v17.0/${settings.phoneId}/media`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${settings.accessToken}`,
            },
          }
        );

        mediaId = mediaResponse.data?.id || null;
      }

      const requestBody = mediaId
        ? {
            messaging_product: "whatsapp",
            to: phone,
            type: "document",
            document: {
              id: mediaId,
              filename: pdfFilename || "Invoice.pdf",
              caption: message || "Your invoice is ready."
            }
          }
        : pdfUrl
          ? {
              messaging_product: "whatsapp",
              to: phone,
              type: "document",
              document: {
                link: pdfUrl,
                filename: pdfFilename || "Invoice.pdf",
                caption: message || "Your invoice is ready."
              }
            }
          : {
              messaging_product: "whatsapp",
              to: phone,
              type: "text",
              text: {
                preview_url: false,
                body: message || "Your invoice is ready."
              }
            };

      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${settings.phoneId}/messages`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${settings.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("WhatsApp error:", error.response?.data || error.message);
      sendApiError(res, error);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
