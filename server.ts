import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import axios from "axios";
import PDFDocument from "pdfkit";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase for server-side data fetching
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

function getCompanySettingsDocId(kind: 'shop' | 'communication', companyId?: string | null) {
  return `${kind}_${companyId || 'global'}`;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // PDF Generation Route
  app.get("/api/invoices/:id.pdf", async (req, res) => {
    const { id } = req.params;
    const compact = String(req.query.compact || '') === '1';
    console.log(`Generating PDF for sale ID: ${id}`);
    
    try {
      // Fetch Sale Data
      const saleSnap = await getDoc(doc(db, 'sales', id));
      if (!saleSnap.exists()) {
        console.error(`Sale not found: ${id}`);
        return res.status(404).send("Sale not found");
      }
      const sale = saleSnap.data();
      console.log(`Sale data fetched:`, JSON.stringify(sale));
      
      // Fetch Shop Settings
      const shopSnap = await getDoc(doc(db, 'settings', getCompanySettingsDocId('shop', sale.company_id)));
      const shop = shopSnap.exists() ? shopSnap.data() : {
        name: 'AppleBerry Care Centre',
        address: '123 Repair Street, Tech City',
        phone: '+1 234 567 890',
        email: 'info@appleberry.co.za',
        website: 'www.appleberry.co.za'
      };
      
      // Fetch Customer Data
      let customer = null;
      if (sale.customer_id) {
        const custSnap = await getDoc(doc(db, 'customers', sale.customer_id));
        if (custSnap.exists()) {
          customer = custSnap.data();
        }
      }
      
      // Fetch Items
      const itemsSnap = await getDocs(collection(db, `sales/${id}/items`));
      const items = await Promise.all(itemsSnap.docs.map(async (itemDoc) => {
        const data = itemDoc.data();
        // If name is missing, try to fetch it from products collection
        if (!data.name && data.product_id) {
          try {
            const productSnap = await getDoc(doc(db, 'products', data.product_id));
            if (productSnap.exists()) {
              return { ...data, name: productSnap.data().name };
            }
          } catch (e) {
            console.warn(`Failed to fetch product name for ${data.product_id}:`, e);
          }
        }
        return data;
      }));
      console.log(`Fetched ${items.length} items for sale ${id}`);

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
      if (shop.logoUrl) {
        try {
          console.log(`Fetching logo from: ${shop.logoUrl}`);
          const logoResponse = await axios.get(shop.logoUrl, { 
            responseType: 'arraybuffer',
            timeout: 5000 
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
      console.log(`PDF generation completed for sale ${id}`);
      
    } catch (error: any) {
      console.error("PDF Generation error:", error);
      if (!res.headersSent) {
        res.status(500).send(`Error generating PDF: ${error.message}`);
      }
    }
  });

  // API Routes
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text, html, attachments, settings, companyId } = req.body;

    const savedSettingsSnap = await getDoc(doc(db, 'settings', getCompanySettingsDocId('communication', companyId)));
    const savedSettings = savedSettingsSnap.exists() ? savedSettingsSnap.data() as any : null;
    if (!savedSettings || savedSettings.mode !== 'live') {
      return res.status(403).json({ error: "Messaging is currently in Test Mode. Switch to Live Mode in Communication Settings to enable outbound email." });
    }

    if (!settings || !settings.host) {
      return res.status(400).json({ error: "Email settings missing" });
    }

    try {
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
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/send-whatsapp", async (req, res) => {
    const { phone, message, pdfUrl, pdfBase64, pdfFilename, settings, companyId } = req.body;

    const savedSettingsSnap = await getDoc(doc(db, 'settings', getCompanySettingsDocId('communication', companyId)));
    const savedSettings = savedSettingsSnap.exists() ? savedSettingsSnap.data() as any : null;
    if (!savedSettings || savedSettings.mode !== 'live') {
      return res.status(403).json({ error: "Messaging is currently in Test Mode. Switch to Live Mode in Communication Settings to enable outbound WhatsApp." });
    }

    if (!settings) {
      return res.status(400).json({ error: "WhatsApp settings missing" });
    }

    try {
      if (settings.provider === 'unofficial') {
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

        console.log("Sending WhatsApp via Unofficial API:", settings.apiUrl, JSON.stringify(payload, null, 2));

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
          
          console.log("WhatsApp API Response:", response.status, JSON.stringify(response.data, null, 2));
          return res.json({ success: true, data: response.data });
        } catch (axiosError: any) {
          console.error("WhatsApp API Axios Error:", axiosError.response?.status, JSON.stringify(axiosError.response?.data, null, 2));
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
      res.status(500).json({ error: error.response?.data || error.message });
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
