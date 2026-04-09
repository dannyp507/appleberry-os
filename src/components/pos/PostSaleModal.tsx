import React, { useState } from 'react';
import { X, Mail, MessageSquare, Download, Check, AlertCircle } from 'lucide-react';
import { generateInvoicePDF } from '../../lib/pdf';
import { Repair, Customer, CommunicationSettings } from '../../types';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import axios from 'axios';
import { useTenant } from '../../lib/tenant';
import { getCompanySettingsDocId } from '../../lib/company';

interface InvoiceSummary {
  created_at: string;
  subtotal: number;
  global_discount: number;
  total_amount: number;
}

interface PostSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  repair: Repair | null;
  customer: Customer | null;
  cart: any[];
  saleId?: string;
  invoiceSummary?: InvoiceSummary | null;
}

export default function PostSaleModal({ isOpen, onClose, repair, customer, cart, saleId, invoiceSummary }: PostSaleModalProps) {
  const { companyId } = useTenant();
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>(null);

  React.useEffect(() => {
    if (isOpen) {
      getDoc(doc(db, 'settings', getCompanySettingsDocId('shop', companyId || 'global'))).then(snap => {
        if (snap.exists()) setShopSettings(snap.data());
      });
    }
  }, [companyId, isOpen]);

  if (!isOpen) return null;

  const normalizePhone = (rawPhone: string) => {
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('27')) return digits;
    if (digits.startsWith('0')) return `27${digits.slice(1)}`;
    return digits;
  };

  const invoiceRecord: Partial<Repair> = {
    id: saleId || repair?.id || 'sale',
    ticket_number: repair?.ticket_number,
    device_name: repair?.device_name || 'General Sale',
    imei: repair?.imei || null,
    subtotal: invoiceSummary?.subtotal ?? cart.reduce((sum, item) => {
      const price = item.custom_price ?? item.selling_price ?? item.unit_price ?? item.price ?? 0;
      const discount = item.discount ?? 0;
      return sum + ((price - discount) * (item.quantity ?? 1));
    }, 0),
    global_discount: invoiceSummary?.global_discount ?? 0,
    total_amount: invoiceSummary?.total_amount,
    created_at: invoiceSummary?.created_at || repair?.created_at || new Date().toISOString(),
  };

  const handleDownload = async () => {
    const doc = await generateInvoicePDF(invoiceRecord, customer, cart, shopSettings);
    doc.save(`Invoice_${repair?.ticket_number || 'Sale'}.pdf`);
    toast.success('Invoice downloaded');
  };

  const handleSendEmail = async () => {
    if (!customer?.email) {
      toast.error('Customer has no email address');
      return;
    }

    setSendingEmail(true);
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', getCompanySettingsDocId('communication', companyId || 'global')));
      if (!settingsSnap.exists()) {
        toast.error('Email settings not configured');
        return;
      }
      const settings = settingsSnap.data() as CommunicationSettings;

      const pdfDoc = await generateInvoicePDF(invoiceRecord, customer, cart, shopSettings);
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

      const response = await axios.post('/api/send-email', {
        to: customer.email,
        subject: `Invoice for your repair - ${repair?.ticket_number || 'Sale'}`,
        text: `Hello ${customer.name},\n\nPlease find attached the invoice for your repair.\n\nThank you for your business!`,
        html: `<p>Hello ${customer.name},</p><p>Please find attached the invoice for your repair.</p><p>Thank you for your business!</p>`,
        attachments: [
          {
            filename: `Invoice_${repair?.ticket_number || 'Sale'}.pdf`,
            content: pdfBase64
          }
        ],
        settings: settings.email,
        companyId,
      });

      if (response.data.success) {
        toast.success('Invoice sent via email');
      }
    } catch (error: any) {
      console.error('Email error:', error);
      toast.error(error.response?.data?.error || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!customer?.phone) {
      toast.error('Customer has no phone number');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', getCompanySettingsDocId('communication', companyId || 'global')));
      if (!settingsSnap.exists()) {
        toast.error('WhatsApp settings not configured');
        return;
      }
      const settings = settingsSnap.data() as CommunicationSettings;
      const pdfDoc = await generateInvoicePDF(invoiceRecord, customer, cart, shopSettings, { variant: 'whatsapp' });
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
      const pdfFilename = `Invoice_${repair?.ticket_number || saleId || 'Sale'}.pdf`;

      const pdfUrl = saleId ? `${window.location.origin}/api/invoices/${saleId}.pdf?compact=1` : null;
      const isLocalUrl = pdfUrl ? /:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(pdfUrl) : false;
      const attachmentMessage = `Hello ${customer.name}, your invoice for repair ${repair?.ticket_number || 'Sale'} is attached.`;
      const linkMessage = `Hello ${customer.name}, your invoice for repair ${repair?.ticket_number || 'Sale'} is ready. You can view it here: ${window.location.origin}/view-invoice/${saleId || 'sale'}`;

      if (settings.whatsapp.provider === 'unofficial' && pdfUrl && isLocalUrl) {
        toast.error('WhatsApp can send the message, but not the invoice file while the app is running locally. The PDF link must be on a public URL.');
      }
      
      const response = await axios.post('/api/send-whatsapp', {
        phone: normalizePhone(customer.phone),
        message: settings.whatsapp.provider === 'official' ? attachmentMessage : linkMessage,
        pdfUrl: isLocalUrl ? null : pdfUrl,
        pdfBase64,
        pdfFilename,
        settings: settings.whatsapp,
        companyId,
      });

      if (response.data.success) {
        toast.success('WhatsApp notification sent');
      }
    } catch (error: any) {
      console.error('WhatsApp error:', error);
      toast.error(error.response?.data?.error || 'Failed to send WhatsApp');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Sale Completed!</h2>
              <p className="text-xs text-green-700 font-medium">What would you like to do next?</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-blue-500" />
              <div className="text-left">
                <p className="font-bold text-gray-900">Download PDF</p>
                <p className="text-xs text-gray-500">Save a copy to your device</p>
              </div>
            </div>
          </button>

          <button
            onClick={handleSendEmail}
            disabled={sendingEmail || !customer?.email}
            className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="font-bold text-gray-900">Email Invoice</p>
                <p className="text-xs text-gray-500">{customer?.email || 'No email provided'}</p>
              </div>
            </div>
            {sendingEmail && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>}
          </button>

          <button
            onClick={handleSendWhatsApp}
            disabled={sendingWhatsApp || !customer?.phone}
            className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-green-500" />
              <div className="text-left">
                <p className="font-bold text-gray-900">WhatsApp Invoice</p>
                <p className="text-xs text-gray-500">{customer?.phone || 'No phone provided'}</p>
              </div>
            </div>
            {sendingWhatsApp && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>}
          </button>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
