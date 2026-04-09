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

type InvoicePdfVariant = 'standard' | 'whatsapp';

type InvoicePdfOptions = {
  variant?: InvoicePdfVariant;
};

export async function generateInvoicePDF(
  repair: Partial<Repair>,
  customer: Customer | null,
  items: InvoiceItem[],
  shop?: ShopSettings,
  options: InvoicePdfOptions = {}
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const variant = options.variant || 'standard';
  const isWhatsApp = variant === 'whatsapp';
  const doc = new jsPDF({
    unit: 'mm',
    format: isWhatsApp ? 'a5' : 'a4',
  });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const createdAt = repair.created_at ? new Date(repair.created_at) : new Date();
  const invoiceDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
  const left = isWhatsApp ? 12 : 20;
  const right = pageWidth - left;
  const top = isWhatsApp ? 14 : 20;
  const tableWidth = pageWidth - left * 2;
  const titleSize = isWhatsApp ? 18 : 22;
  const bodySize = isWhatsApp ? 8.5 : 10;
  const labelSize = isWhatsApp ? 10 : 12;
  const footerY = pageHeight - (isWhatsApp ? 12 : 20);
  const computedSubtotal = items.reduce((sum, item) => {
    const price = item.custom_price ?? item.unit_price ?? item.selling_price ?? item.price ?? 0;
    const discount = item.discount ?? 0;
    return sum + ((price - discount) * (item.quantity ?? 1));
  }, 0);
  const subtotal = repair.subtotal ?? computedSubtotal;
  const discount = repair.global_discount ?? 0;
  const grandTotal = repair.total_amount ?? Math.max(0, subtotal - discount);

  if (isWhatsApp) {
    doc.setFillColor(251, 247, 240);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setFillColor(34, 42, 51);
    doc.roundedRect(left, top, tableWidth, 26, 6, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(247, 240, 229);
    doc.text((shop?.name || 'Appleberry OS').toUpperCase(), left + 4, top + 7);
    doc.setFontSize(17);
    doc.text('Invoice', left + 4, top + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Issued ${invoiceDate.toLocaleDateString()}`, left + 4, top + 22);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(left, top + 31, tableWidth, 28, 5, 5, 'F');
    doc.setDrawColor(233, 224, 211);
    doc.roundedRect(left, top + 31, tableWidth, 28, 5, 5);
    doc.setTextColor(120, 53, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('AMOUNT DUE', left + 4, top + 38);
    doc.setFontSize(18);
    doc.text(formatCurrency(grandTotal), left + 4, top + 49);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Invoice #${repair.ticket_number || repair.id?.slice(0, 8) || 'Sale'}`, right - 4, top + 38, { align: 'right' });
    const totalMeta = repair.device_name || customer?.name || 'General sale';
    const totalMetaLines = doc.splitTextToSize(totalMeta, tableWidth * 0.42);
    doc.text(totalMetaLines, right - 4, top + 46, { align: 'right', maxWidth: tableWidth * 0.42 });

    let sectionY = top + 66;
    const blockGap = 5;
    const blockWidth = (tableWidth - blockGap) / 2;
    const customerBlockHeight = customer?.email ? 26 : customer?.phone ? 22 : 18;
    const deviceBlockHeight = repair.imei ? 26 : 18;
    const blockHeight = Math.max(customerBlockHeight, deviceBlockHeight);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(left, sectionY, blockWidth, blockHeight, 4, 4, 'F');
    doc.roundedRect(left + blockWidth + blockGap, sectionY, blockWidth, blockHeight, 4, 4, 'F');
    doc.setDrawColor(233, 224, 211);
    doc.roundedRect(left, sectionY, blockWidth, blockHeight, 4, 4);
    doc.roundedRect(left + blockWidth + blockGap, sectionY, blockWidth, blockHeight, 4, 4);

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('BILL TO', left + 4, sectionY + 6);
    doc.text('DEVICE', left + blockWidth + blockGap + 4, sectionY + 6);

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let infoY = sectionY + 12;
    const customerNameLines = doc.splitTextToSize(customer?.name || 'Walk-in Customer', blockWidth - 8);
    doc.text(customerNameLines, left + 4, infoY);
    infoY += customerNameLines.length * 3.8;
    if (customer?.phone) {
      doc.text(customer.phone, left + 4, infoY);
      infoY += 4;
    }
    if (customer?.email) {
      const emailLines = doc.splitTextToSize(customer.email, blockWidth - 8);
      doc.text(emailLines, left + 4, infoY);
    }

    let deviceInfoY = sectionY + 12;
    const deviceLines = doc.splitTextToSize(repair.device_name || 'General Sale', blockWidth - 8);
    doc.text(deviceLines, left + blockWidth + blockGap + 4, deviceInfoY);
    deviceInfoY += deviceLines.length * 3.8;
    if (repair.imei) {
      const imeiLines = doc.splitTextToSize(`IMEI: ${repair.imei}`, blockWidth - 8);
      doc.text(imeiLines, left + blockWidth + blockGap + 4, deviceInfoY);
    }

    sectionY += blockHeight + 6;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(left, sectionY, tableWidth, 68, 5, 5, 'F');
    doc.setDrawColor(233, 224, 211);
    doc.roundedRect(left, sectionY, tableWidth, 68, 5, 5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('ITEMS', left + 4, sectionY + 6);

    autoTable(doc, {
      startY: sectionY + 9,
      head: [['Item', 'Qty', 'Total']],
      body: items.map(item => {
        const price = item.custom_price ?? item.unit_price ?? item.selling_price ?? item.price ?? 0;
        const lineQty = item.quantity ?? 1;
        const lineDiscount = item.discount ?? 0;
        const finalPrice = price - lineDiscount;
        return [
          item.name || 'Item',
          String(lineQty),
          formatCurrency(finalPrice * lineQty),
        ];
      }),
      margin: { left: left + 2, right: left + 2 },
      tableWidth: tableWidth - 4,
      theme: 'plain',
      styles: {
        fontSize: 8.6,
        cellPadding: 1.8,
        textColor: [51, 65, 85],
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [248, 240, 229],
        textColor: [120, 53, 15],
        fontSize: 7.2,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: {
        0: { cellWidth: tableWidth * 0.58 },
        1: { cellWidth: tableWidth * 0.14, halign: 'center' },
        2: { cellWidth: tableWidth * 0.22, halign: 'right' },
      },
    });

    const itemsEndY = (doc as any).lastAutoTable.finalY;
    const totalsCardY = Math.min(itemsEndY + 6, pageHeight - 46);
    const totalsCardHeight = discount > 0 ? 20 : 15;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(left, totalsCardY, tableWidth, totalsCardHeight, 5, 5, 'F');
    doc.setDrawColor(233, 224, 211);
    doc.roundedRect(left, totalsCardY, tableWidth, totalsCardHeight, 5, 5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Subtotal', left + 4, totalsCardY + 6);
    doc.text(formatCurrency(subtotal), right - 4, totalsCardY + 6, { align: 'right' });
    let compactTotalsY = totalsCardY + 11;
    if (discount > 0) {
      doc.text('Discount', left + 4, compactTotalsY);
      doc.text(`-${formatCurrency(discount)}`, right - 4, compactTotalsY, { align: 'right' });
      compactTotalsY += 5;
    }
    doc.setTextColor(120, 53, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Grand total', left + 4, compactTotalsY);
    doc.text(formatCurrency(grandTotal), right - 4, compactTotalsY, { align: 'right' });

    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Optimised for WhatsApp viewing', pageWidth / 2, footerY, { align: 'center' });
    return doc;
  }

  // Header
  doc.setFontSize(titleSize);
  doc.setTextColor(51, 65, 85); // Slate 700
  doc.text('INVOICE', pageWidth / 2, top, { align: 'center' });

  if (isWhatsApp) {
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(left, top + 5, tableWidth, pageHeight - 28, 4, 4);
  }

  // Shop Info
  doc.setFontSize(bodySize);
  doc.setTextColor(100, 116, 139); // Slate 500
  let shopY = isWhatsApp ? top + 12 : 35;
  doc.text(shop?.name || 'My Repair Shop', left, shopY);
  shopY += isWhatsApp ? 4 : 5;
  if (shop?.address) {
    const addressLines = doc.splitTextToSize(shop.address, isWhatsApp ? tableWidth * 0.52 : 70);
    doc.text(addressLines, left, shopY);
    shopY += addressLines.length * (isWhatsApp ? 3.8 : 5);
  }
  doc.text(`Phone: ${shop?.phone || '+1 234 567 890'}`, left, shopY);
  shopY += isWhatsApp ? 4 : 5;
  if (shop?.email) {
    doc.text(`Email: ${shop.email}`, left, shopY);
  }

  // Invoice Details
  doc.setTextColor(51, 65, 85);
  doc.text(`Invoice #: ${repair.ticket_number || repair.id?.slice(0, 8) || 'Sale'}`, right, isWhatsApp ? top + 12 : 35, { align: 'right' });
  doc.text(`Date: ${invoiceDate.toLocaleDateString()}`, right, isWhatsApp ? top + 16 : 40, { align: 'right' });

  // Customer Info
  const infoTop = isWhatsApp ? top + 28 : 60;
  doc.setFontSize(labelSize);
  doc.text('BILL TO:', left, infoTop);
  doc.setFontSize(bodySize);
  let billY = infoTop + (isWhatsApp ? 5 : 7);
  doc.text(customer?.name || 'Walk-in Customer', left, billY);
  if (customer?.phone) {
    billY += isWhatsApp ? 4 : 5;
    doc.text(customer.phone, left, billY);
  }
  if (customer?.email) {
    billY += isWhatsApp ? 4 : 5;
    const emailLines = doc.splitTextToSize(customer.email, tableWidth * 0.42);
    doc.text(emailLines, left, billY);
  }

  // Device Info
  const deviceX = isWhatsApp ? pageWidth * 0.56 : pageWidth / 2;
  doc.setFontSize(labelSize);
  doc.text('DEVICE:', deviceX, infoTop);
  doc.setFontSize(bodySize);
  let deviceY = infoTop + (isWhatsApp ? 5 : 7);
  const deviceLines = doc.splitTextToSize(repair.device_name || 'General Sale', tableWidth * 0.38);
  doc.text(deviceLines, deviceX, deviceY);
  if (repair.imei) {
    deviceY += deviceLines.length * (isWhatsApp ? 3.8 : 5);
    doc.text(`IMEI: ${repair.imei}`, deviceX, deviceY);
  }

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
    startY: isWhatsApp ? infoTop + 16 : 90,
    head: [['Item', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left, right: left },
    tableWidth,
    styles: {
      fontSize: isWhatsApp ? 8.6 : 9,
      cellPadding: isWhatsApp ? 1.6 : 3,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [51, 65, 85],
      fontSize: isWhatsApp ? 8.2 : 9,
      cellPadding: isWhatsApp ? 1.8 : 3,
    },
    columnStyles: isWhatsApp
      ? {
          0: { cellWidth: tableWidth * 0.46 },
          1: { cellWidth: tableWidth * 0.12, halign: 'center' },
          2: { cellWidth: tableWidth * 0.21, halign: 'right' },
          3: { cellWidth: tableWidth * 0.21, halign: 'right' },
        }
      : undefined,
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // Totals
  doc.setFontSize(bodySize);
  const totalsLabelX = right - (isWhatsApp ? 38 : 40);
  const totalsStartY = finalY + (isWhatsApp ? 7 : 15);
  if (isWhatsApp) {
    doc.setDrawColor(230, 236, 242);
    doc.line(left, totalsStartY - 4, right, totalsStartY - 4);
  }
  doc.text('Subtotal:', totalsLabelX, totalsStartY);
  doc.text(formatCurrency(subtotal), right, totalsStartY, { align: 'right' });

  let totalsY = finalY + (isWhatsApp ? 12 : 22);
  if (discount > 0) {
    doc.text('Discount:', totalsLabelX, totalsY);
    doc.text(`-${formatCurrency(discount)}`, right, totalsY, { align: 'right' });
    totalsY += isWhatsApp ? 5 : 10;
  }

  doc.setFontSize(isWhatsApp ? 12.5 : 14);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', totalsLabelX, totalsY);
  doc.text(formatCurrency(grandTotal), right, totalsY, { align: 'right' });

  if (isWhatsApp) {
    const badgeWidth = 62;
    const badgeHeight = 10;
    const badgeY = totalsY + 8;
    doc.setFillColor(248, 240, 229);
    doc.roundedRect(right - badgeWidth, badgeY, badgeWidth, badgeHeight, 3, 3, 'F');
    doc.setTextColor(141, 62, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Easy to view on WhatsApp', right - 4, badgeY + 6.5, { align: 'right' });
    doc.setTextColor(148, 163, 184);
  }

  // Footer
  doc.setFontSize(isWhatsApp ? 7.5 : 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(isWhatsApp ? 'Thank you for choosing us' : 'Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });

  return doc;
}
