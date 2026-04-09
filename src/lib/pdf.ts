import { formatCurrency } from './utils';
import { Repair, Customer, ShopSettings } from '../types';

type InvoiceItem = {
  name?: string;
  quantity?: number;
  unit_price?: number;
  selling_price?: number;
  custom_price?: number;
  price?: number;
  discount?: number;
  total_price?: number;
};

export async function generateInvoicePDF(repair: Partial<Repair>, customer: Customer | null, items: InvoiceItem[], shop?: ShopSettings) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const createdAt = repair.created_at ? new Date(repair.created_at) : new Date();
  const invoiceDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(51, 65, 85); // Slate 700
  doc.text('INVOICE', pageWidth / 2, 20, { align: 'center' });

  // Shop Info
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(shop?.name || 'My Repair Shop', 20, 35);
  doc.text(shop?.address || '123 Repair Street, Tech City', 20, 40);
  doc.text(`Phone: ${shop?.phone || '+1 234 567 890'}`, 20, 45);
  if (shop?.email) doc.text(`Email: ${shop.email}`, 20, 50);

  // Invoice Details
  doc.setTextColor(51, 65, 85);
  doc.text(`Invoice #: ${repair.ticket_number || repair.id?.slice(0, 8) || 'Sale'}`, pageWidth - 20, 35, { align: 'right' });
  doc.text(`Date: ${invoiceDate.toLocaleDateString()}`, pageWidth - 20, 40, { align: 'right' });

  // Customer Info
  doc.setFontSize(12);
  doc.text('BILL TO:', 20, 60);
  doc.setFontSize(10);
  doc.text(customer?.name || 'Walk-in Customer', 20, 67);
  if (customer?.phone) doc.text(customer.phone, 20, 72);
  if (customer?.email) doc.text(customer.email, 20, 77);

  // Device Info
  doc.setFontSize(12);
  doc.text('DEVICE:', pageWidth / 2, 60);
  doc.setFontSize(10);
  doc.text(repair.device_name || 'General Sale', pageWidth / 2, 67);
  if (repair.imei) doc.text(`IMEI: ${repair.imei}`, pageWidth / 2, 72);

  // Table
  const tableData = items.map(item => {
    const price = item.custom_price ?? item.unit_price ?? item.selling_price ?? item.price ?? 0;
    const discount = item.discount ?? 0;
    const finalPrice = price - discount;
    
    return [
      item.name,
      item.quantity,
      formatCurrency(finalPrice),
      formatCurrency(finalPrice * item.quantity)
    ];
  });

  autoTable(doc, {
    startY: 90,
    head: [['Item', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    headStyles: { fillColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // Totals
  const computedSubtotal = items.reduce((sum, item) => {
    const price = item.custom_price ?? item.unit_price ?? item.selling_price ?? item.price ?? 0;
    const discount = item.discount ?? 0;
    return sum + ((price - discount) * item.quantity);
  }, 0);
  const subtotal = repair.subtotal ?? computedSubtotal;
  const discount = repair.global_discount ?? 0;
  const grandTotal = repair.total_amount ?? Math.max(0, subtotal - discount);

  doc.text('Subtotal:', pageWidth - 60, finalY + 15);
  doc.text(formatCurrency(subtotal), pageWidth - 20, finalY + 15, { align: 'right' });

  let totalsY = finalY + 22;
  if (discount > 0) {
    doc.text('Discount:', pageWidth - 60, totalsY);
    doc.text(`-${formatCurrency(discount)}`, pageWidth - 20, totalsY, { align: 'right' });
    totalsY += 10;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', pageWidth - 60, totalsY);
  doc.text(formatCurrency(grandTotal), pageWidth - 20, totalsY, { align: 'right' });

  // Footer
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Thank you for your business!', pageWidth / 2, doc.internal.pageSize.height - 20, { align: 'center' });

  return doc;
}
