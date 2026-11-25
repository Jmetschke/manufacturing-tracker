// Used only when the original PDF reader cannot read a document, or for a
// recognized Webstaurant table. Existing Amazon/generic parsing stays intact.
async function readOrderPdfLines(buffer) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true });
  let document;
  try {
    document = await loading.promise;
    if (document.numPages > 100) throw new Error('Please upload an order PDF with 100 pages or fewer.');
    const lines = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows = [];
      for (const item of content.items) {
        if (!item.str?.trim()) continue;
        const y = item.transform[5];
        let row = rows.find(row => Math.abs(row.y - y) < 2);
        if (!row) { row = { y, items: [] }; rows.push(row); }
        row.items.push({ x: item.transform[4], text: item.str });
      }
      rows.sort((a, b) => b.y - a.y).forEach(row => {
        lines.push(row.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ').replace(/\s+/g, ' ').trim());
      });
      page.cleanup();
    }
    return lines;
  } finally { await loading.destroy(); }
}

function parseWebstaurantOrder(lines, parseDate) {
  if (!lines.some(line => /webstaurant\s*store/i.test(line))) return null;
  const orderNumber = lines.join('\n').match(/Order\s+Number:\s*([\w-]+)/i)?.[1] || '';
  const orderDateLine = lines.find(line => /^Order Placed:/i.test(line));
  const dateOrdered = parseDate(orderDateLine);
  // Never interpret the order date or pending-processing status as delivery.
  const delivered = lines.find(line => /^(?:Delivered(?: on)?|Delivery Date|Date Delivered):?\s+\S/i.test(line));
  const expected = lines.find(line => /^(?:Expected|Estimated) Delivery(?: Date)?:?\s+/i.test(line));
  const receivedDate = delivered ? parseDate(delivered) : '';
  const expectedDate = receivedDate || (expected ? parseDate(expected) : '');
  const items = [];
  let inTable = false, description = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^Item\s+Price\s+Qty\s+Total$/i.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (/^(?:Sub\s*Total|Shipping\s*&\s*Handling|Estimated Tax|Total):/i.test(line)) { inTable = false; description = []; continue; }
    if (/^(?:Page\s+\d|https?:|Print this page|Thank you|Order Details:|.*Order Confirmation$)/i.test(line)) continue;
    // Product codes and the KIT badge are separate from the description.
    if (/^(?:KIT|[A-Z0-9-]*\d[A-Z0-9-]*)$/.test(line)) continue;
    const row = line.match(/^(.*?)\s*\$[\d,]+\.\d{2}\s+(\d+)\s+\$[\d,]+\.\d{2}$/);
    if (!row) { description.push(line); continue; }
    if (row[1]) description.push(row[1]);
    const name = description.join(' ').replace(/\s+/g, ' ').trim();
    const quantity = Number(row[2]);
    if (!name || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Could not read a Webstaurant item quantity. No items were imported.');
    const pack = name.match(/\b(\d+)\s*\/\s*(?:Case|Pack|Box)\b/i);
    items.push({ item_name: name, package_qty: quantity, units_per_package: pack ? Number(pack[1]) : 1,
      item_supplier: 'WebstaurantStore', expected_delivery_date: expectedDate,
      received_date: receivedDate, received_location: receivedDate ? 'Imported PDF' : '',
      import_needs_delivery_date: expectedDate ? 0 : 1 });
    description = [];
  }
  return { date_ordered: dateOrdered, order_number: orderNumber,
    item_company: orderNumber ? `WebstaurantStore Order ${orderNumber}` : 'WebstaurantStore Order', items };
}
module.exports = { readOrderPdfLines, parseWebstaurantOrder };
