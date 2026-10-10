import PDFDocument from 'pdfkit';

/**
 * Generates an executive, professional PDF document buffer
 * Supports: Quotation, Delivery Order, and Tax Invoice with custom tenant branding & presets
 * @param {Object} docRecord - Database record from quotes table
 * @param {Array} items - Line items from quote_items table
 * @param {Object} branding - Tenant branding and document settings
 * @returns {Promise<Buffer>}
 */
export function generateDocumentPdfBuffer(docRecord, items = [], branding = {}) {
  return new Promise((resolve, reject) => {
    try {
      const docType = docRecord.doc_type || (
        docRecord.quote_number?.startsWith('DO-') ? 'Delivery Order' :
        docRecord.quote_number?.startsWith('INV-') ? 'Invoice' : 'Quotation'
      );

      const currency = branding.currency_symbol || '$';
      const companyName = branding.company_name || 'ABADI GURU CRM Systems';
      const companyReg = branding.company_reg_no ? `Reg: ${branding.company_reg_no}` : '';
      const companyAddress = branding.company_address || 'Level 28, Tower 1, Business Financial District';
      const companyContact = [branding.company_phone, branding.company_email, branding.company_website].filter(Boolean).join(' • ');

      const doc = new PDFDocument({
        margin: 45,
        size: 'A4',
        info: {
          Title: `${docType} ${docRecord.quote_number}`,
          Author: companyName,
          Subject: docRecord.subject || `${docType} Document`,
        }
      });

      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      // Theme colors based on document type
      let headerBg = '#0f172a'; // Deep slate
      let accentColor = '#38bdf8'; // Sky blue
      let badgeTitle = 'QUOTATION';

      if (docType === 'Delivery Order') {
        headerBg = '#0f2937'; // Teal slate
        accentColor = '#2dd4bf'; // Emerald/Teal
        badgeTitle = 'DELIVERY ORDER';
      } else if (docType === 'Invoice') {
        headerBg = '#0a192f'; // Navy dark
        accentColor = '#34d399'; // Green/Emerald
        badgeTitle = 'TAX INVOICE';
      }

      const primaryColor = '#1e293b';
      const darkColor = '#0f172a';
      const mutedColor = '#64748b';
      const lightBg = '#f8fafc';
      const borderColor = '#e2e8f0';

      // ================= HEADER =================
      doc.rect(0, 0, 612, 105).fill(headerBg);

      // Company Logo or Vector Brand
      let logoDrawn = false;
      if (branding.company_logo && branding.company_logo.includes('base64,')) {
        try {
          const base64Data = branding.company_logo.split('base64,')[1];
          const imgBuf = Buffer.from(base64Data, 'base64');
          doc.image(imgBuf, 45, 20, { fit: [140, 48] });
          logoDrawn = true;
        } catch (imgErr) {
          console.warn('[PDF] Could not draw logo image buffer, falling back to text:', imgErr.message);
        }
      }

      if (!logoDrawn) {
        doc.fontSize(20).fillColor('#ffffff').font('Helvetica-Bold').text(companyName, 45, 28);
        if (companyReg) {
          doc.fontSize(8.5).fillColor('#94a3b8').font('Helvetica').text(companyReg, 45, 52);
        }
        doc.fontSize(8).fillColor('#cbd5e1').font('Helvetica').text(companyAddress, 45, 66, { width: 300, lineBreak: false });
      } else {
        // If logo was drawn, put address below or beside
        if (companyReg) {
          doc.fontSize(8).fillColor('#94a3b8').font('Helvetica').text(companyReg, 45, 72);
        }
        doc.fontSize(7.5).fillColor('#cbd5e1').font('Helvetica').text(companyAddress, 45, 83, { width: 320, lineBreak: false });
      }

      // Document Title Badge on Top Right
      doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold').text(badgeTitle, 360, 26, { align: 'right', width: 205 });
      doc.fontSize(11).fillColor(accentColor).font('Helvetica-Bold').text(docRecord.quote_number || 'DOC-2026-0001', 360, 48, { align: 'right', width: 205 });

      if (docRecord.parent_doc_number) {
        doc.fontSize(8).fillColor('#94a3b8').font('Helvetica').text(`Ref: ${docRecord.parent_doc_number}`, 360, 64, { align: 'right', width: 205 });
      }

      // ================= METADATA SECTION =================
      const startMetaY = 120;

      // Left Column: Client / Recipient Info
      const recipientHeader = docType === 'Delivery Order' ? 'DELIVER TO / RECIPIENT' : (docType === 'Invoice' ? 'BILLED TO' : 'PREPARED FOR');
      doc.fontSize(8).fillColor(mutedColor).font('Helvetica-Bold').text(recipientHeader, 45, startMetaY);
      doc.fontSize(12).fillColor(darkColor).font('Helvetica-Bold').text(docRecord.account_name || 'Valued Client', 45, startMetaY + 13);

      let clientSubY = startMetaY + 30;
      if (docRecord.contact_name) {
        doc.fontSize(9).fillColor(darkColor).font('Helvetica').text(`Attn: ${docRecord.contact_name}`, 45, clientSubY);
        clientSubY += 13;
      }

      if (docType === 'Delivery Order' && docRecord.recipient_address) {
        doc.fontSize(8.5).fillColor(mutedColor).font('Helvetica').text(`Delivery Address: ${docRecord.recipient_address}`, 45, clientSubY, { width: 270 });
        clientSubY += 22;
      } else if (docRecord.billing_street) {
        const fullAddr = [docRecord.billing_street, docRecord.billing_city, docRecord.billing_state, docRecord.billing_country].filter(Boolean).join(', ');
        doc.fontSize(8.5).fillColor(mutedColor).font('Helvetica').text(fullAddr, 45, clientSubY, { width: 270 });
        clientSubY += 14;
      }

      doc.fontSize(8.5).fillColor(mutedColor).font('Helvetica-Oblique').text(docRecord.subject || `${docType} Order`, 45, clientSubY, { width: 270 });

      // Right Column: Details Box
      const rightColX = 360;
      const rightValX = 460;
      doc.fontSize(8).fillColor(mutedColor).font('Helvetica-Bold').text('DOCUMENT DETAILS', rightColX, startMetaY);

      const issueDate = (docRecord.created_at || new Date().toISOString()).split(' ')[0];
      const metaRows = [];

      if (docType === 'Quotation') {
        metaRows.push({ label: 'Date Issued:', val: issueDate });
        metaRows.push({ label: 'Valid Until:', val: docRecord.valid_until || '30 Days' });
        metaRows.push({ label: 'Status:', val: (docRecord.quote_stage || 'Draft').toUpperCase() });
        metaRows.push({ label: 'Sales Rep:', val: docRecord.owner_name || 'Account Manager' });
      } else if (docType === 'Delivery Order') {
        metaRows.push({ label: 'DO Date:', val: docRecord.delivery_date || issueDate });
        metaRows.push({ label: 'Tracking / Driver:', val: docRecord.tracking_number || 'Fleet Dispatch' });
        metaRows.push({ label: 'Status:', val: (docRecord.quote_stage || 'Delivered').toUpperCase() });
        metaRows.push({ label: 'Ref Quotation:', val: docRecord.parent_doc_number || 'N/A' });
      } else {
        // Invoice
        metaRows.push({ label: 'Invoice Date:', val: issueDate });
        metaRows.push({ label: 'Payment Due:', val: docRecord.valid_until || branding.invoice_payment_terms || 'Net 30' });
        metaRows.push({ label: 'Status:', val: (docRecord.quote_stage || 'Confirmed').toUpperCase() });
        metaRows.push({ label: 'Ref Document:', val: docRecord.parent_doc_number || 'Direct Billing' });
      }

      let metaY = startMetaY + 14;
      metaRows.forEach(row => {
        doc.fontSize(8.5).fillColor(mutedColor).font('Helvetica').text(row.label, rightColX, metaY, { width: 95 });
        doc.fontSize(8.5).fillColor(darkColor).font('Helvetica-Bold').text(row.val, rightValX, metaY, { width: 105, align: 'right' });
        metaY += 14;
      });

      // ================= LINE ITEMS TABLE =================
      const tableTop = Math.max(startMetaY + 75, clientSubY + 20);

      // Table Header Row
      doc.rect(45, tableTop, 522, 22).fill(headerBg);
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      doc.text('#', 55, tableTop + 6, { width: 20 });
      doc.text('DESCRIPTION / ITEM SPECIFICATION', 85, tableTop + 6, { width: 240 });

      const isDO = docType === 'Delivery Order';
      const showPricesOnDO = branding.do_show_prices !== '0';

      if (isDO && !showPricesOnDO) {
        doc.text('QTY ORDERED', 330, tableTop + 6, { width: 70, align: 'center' });
        doc.text('QTY DELIVERED', 410, tableTop + 6, { width: 70, align: 'center' });
        doc.text('CONDITION / REMARKS', 485, tableTop + 6, { width: 80, align: 'right' });
      } else {
        doc.text('QTY', 330, tableTop + 6, { width: 40, align: 'center' });
        doc.text(`PRICE (${currency})`, 380, tableTop + 6, { width: 80, align: 'right' });
        doc.text(`TOTAL (${currency})`, 470, tableTop + 6, { width: 90, align: 'right' });
      }

      // Table Rows
      let currentY = tableTop + 22;
      const lineItems = (items && items.length > 0)
        ? items
        : [{ product_name: docRecord.subject || 'Standard Service Package', quantity: 1, unit_price: docRecord.subtotal || docRecord.grand_total || 0, line_total: docRecord.subtotal || docRecord.grand_total || 0 }];

      lineItems.forEach((item, index) => {
        const isEven = index % 2 === 0;
        if (isEven) {
          doc.rect(45, currentY, 522, 24).fill(lightBg);
        }
        doc.rect(45, currentY + 23, 522, 1).fill(borderColor);

        doc.fillColor(darkColor).fontSize(8.5).font('Helvetica');
        doc.text(String(index + 1), 55, currentY + 7, { width: 20 });
        doc.font('Helvetica-Bold').text(item.product_name || 'Service Item', 85, currentY + 7, { width: 240, lineBreak: false });

        if (isDO && !showPricesOnDO) {
          doc.font('Helvetica').text(String(item.quantity || 1), 330, currentY + 7, { width: 70, align: 'center' });
          doc.font('Helvetica-Bold').text(String(item.quantity || 1), 410, currentY + 7, { width: 70, align: 'center' });
          doc.font('Helvetica').text('Good Order', 485, currentY + 7, { width: 80, align: 'right' });
        } else {
          doc.font('Helvetica').text(String(item.quantity || 1), 330, currentY + 7, { width: 40, align: 'center' });
          doc.text(`${Number(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 380, currentY + 7, { width: 80, align: 'right' });
          doc.font('Helvetica-Bold').text(`${Number(item.line_total || (item.unit_price * item.quantity) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 470, currentY + 7, { width: 90, align: 'right' });
        }

        currentY += 24;
      });

      // ================= TOTALS & SUMMARY =================
      const subtotal = Number(docRecord.subtotal) || Number(docRecord.grand_total) || 0;
      const taxPercent = Number(docRecord.tax_percent) || Number(branding.invoice_default_tax) || 8.0;
      const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
      const grandTotal = Number(docRecord.grand_total) || (subtotal + taxAmount);

      const summaryTop = currentY + 15;
      const summaryBoxX = 340;
      const summaryBoxW = 227;

      if (!isDO || showPricesOnDO) {
        doc.fontSize(8.5).fillColor(mutedColor).font('Helvetica').text('Subtotal:', summaryBoxX, summaryTop);
        doc.fontSize(8.5).fillColor(darkColor).font('Helvetica-Bold').text(`${currency} ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, summaryBoxX + 80, summaryTop, { width: 147, align: 'right' });

        doc.fontSize(8.5).fillColor(mutedColor).font('Helvetica').text(`Tax (${taxPercent}%):`, summaryBoxX, summaryTop + 16);
        doc.fontSize(8.5).fillColor(darkColor).font('Helvetica-Bold').text(`${currency} ${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, summaryBoxX + 80, summaryTop + 16, { width: 147, align: 'right' });

        // Highlight Grand Total Box
        doc.rect(summaryBoxX, summaryTop + 34, summaryBoxW, 30).fill(headerBg);
        doc.fontSize(9.5).fillColor('#ffffff').font('Helvetica-Bold').text(docType === 'Quotation' ? 'TOTAL QUOTE' : 'TOTAL DUE', summaryBoxX + 12, summaryTop + 43);
        doc.fontSize(11).fillColor(accentColor).font('Helvetica-Bold').text(`${currency} ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, summaryBoxX + 80, summaryTop + 42, { width: 135, align: 'right' });
      }

      // ================= BOTTOM SECTION ACCORDING TO DOC TYPE =================
      const bottomY = summaryTop;

      if (docType === 'Delivery Order') {
        // Large Delivery Acknowledgement Box
        const doBoxY = summaryTop;
        const doBoxW = 522;
        doc.rect(45, doBoxY, doBoxW, 110).fill('#f1f5f9');
        doc.rect(45, doBoxY, doBoxW, 110).stroke(borderColor);

        doc.fontSize(9).fillColor(darkColor).font('Helvetica-Bold').text('GOODS RECEIVED IN GOOD ORDER & SATISFACTORY CONDITION', 55, doBoxY + 10);
        doc.fontSize(7.5).fillColor(mutedColor).font('Helvetica').text(docRecord.terms_conditions || branding.do_default_terms || 'Please verify quantities upon delivery. Sign and chop to acknowledge receipt.', 55, doBoxY + 24, { width: 500 });

        // Signatures inside DO box
        const sigLineY = doBoxY + 75;

        // Left signature: Dispatched / Delivered By
        doc.rect(60, sigLineY, 180, 1).fill('#94a3b8');
        doc.fontSize(8).fillColor(darkColor).font('Helvetica-Bold').text('Delivered By (Driver / Dispatcher)', 60, sigLineY + 6);
        doc.fontSize(7.5).fillColor(mutedColor).text('Signature & Date', 60, sigLineY + 17);

        // Right signature: Received By & Official Chop
        doc.rect(320, sigLineY, 230, 1).fill('#94a3b8');
        doc.fontSize(8).fillColor(darkColor).font('Helvetica-Bold').text('Received By (Company Stamp & Signature)', 320, sigLineY + 6);
        doc.fontSize(7.5).fillColor(mutedColor).text('Full Name / NRIC: ___________________ Date: ________', 320, sigLineY + 17);

      } else if (docType === 'Invoice') {
        // Bank Information & Remittance Box
        doc.fontSize(8.5).fillColor(mutedColor).font('Helvetica-Bold').text('PAYMENT INSTRUCTIONS & BANK DETAILS', 45, bottomY);
        doc.fontSize(8).fillColor(darkColor).font('Helvetica')
          .text(`• Bank: ${branding.invoice_bank_name || 'Maybank / JPMorgan Chase'}`, 45, bottomY + 14)
          .text(`• Account No: ${branding.invoice_bank_account_no || '4819-2049-1928'}`, 45, bottomY + 26)
          .text(`• Account Name: ${branding.invoice_bank_account_name || companyName}`, 45, bottomY + 38);

        if (branding.invoice_swift_code) {
          doc.text(`• SWIFT / Routing: ${branding.invoice_swift_code}`, 45, bottomY + 50);
        }

        const invTerms = docRecord.terms_conditions || branding.invoice_default_terms || 'Payment is due within 30 days. Please quote invoice number upon remittance.';
        doc.fontSize(7.5).fillColor(mutedColor).font('Helvetica-Oblique').text(`Remittance Note: ${invTerms}`, 45, bottomY + 64, { width: 280 });

        // Authorized Stamp / Signature
        const authY = bottomY + 95;
        doc.rect(45, authY, 160, 1).fill('#cbd5e1');
        doc.fontSize(7.5).fillColor(mutedColor).font('Helvetica').text('Authorized Finance Signatory', 45, authY + 4);

      } else {
        // Quotation Terms & Customer Acceptance
        doc.fontSize(8.5).fillColor(mutedColor).font('Helvetica-Bold').text('TERMS & CONDITIONS', 45, bottomY);
        const qTerms = docRecord.terms_conditions || branding.quote_default_terms || 'Quotation valid for 30 days from date of issue. Prices quoted are subject to standard delivery terms.';
        doc.fontSize(7.5).fillColor(darkColor).font('Helvetica').text(qTerms, 45, bottomY + 14, { width: 280 });

        // Acceptance signature block
        const signY = bottomY + 70;
        doc.rect(45, signY, 150, 1).fill('#cbd5e1');
        doc.fontSize(7.5).fillColor(mutedColor).font('Helvetica').text(`Prepared by: ${docRecord.owner_name || 'Sales Rep'}`, 45, signY + 4);

        doc.rect(210, signY, 150, 1).fill('#cbd5e1');
        doc.fontSize(7.5).fillColor(mutedColor).font('Helvetica').text('Client Acceptance Signature & Chop', 210, signY + 4);
      }

      // ================= FOOTER =================
      const footerY = 755;
      doc.rect(45, footerY - 8, 522, 1).fill(borderColor);

      const footerNote = (docType === 'Delivery Order' ? branding.do_footer_note : (docType === 'Invoice' ? branding.invoice_footer_note : branding.quote_footer_note)) || 'Thank you for your business!';
      doc.fontSize(8).fillColor(darkColor).font('Helvetica-Bold').text(footerNote, 45, footerY, { align: 'center', width: 522 });
      doc.fontSize(7).fillColor(mutedColor).font('Helvetica').text(`${companyName} • ${companyContact}`, 45, footerY + 11, { align: 'center', width: 522 });
      doc.fontSize(6.5).fillColor('#94a3b8').text(`Generated with ABADI GURU CRM Enterprise Engine • ${docRecord.quote_number}`, 45, footerY + 22, { align: 'center', width: 522 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Backwards compatibility wrapper for invoice generation
 */
export function generateInvoicePdfBuffer(invoice, branding = {}) {
  const items = invoice.items || [];
  return generateDocumentPdfBuffer(invoice, items, branding);
}
