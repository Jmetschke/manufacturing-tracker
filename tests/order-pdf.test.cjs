const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { parseWebstaurantOrder, readOrderPdfLines } = require('../server/order-pdf');
const source = fs.readFileSync('server.js', 'utf8');
const context = { normalizeRequiredText: value => String(value || '').trim(), Date };
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function parseAmazonDate('), source.indexOf('/* ---------- ORDERED ITEMS ---------- */')), context);
const lines = ['Order Confirmation', 'Order Number: 123456789', 'Order Placed: 11/24/2026 at 1:49 PM',
  'Status: Hold - Pending Processing', 'Shipping & Handling: $0.00', 'Order Details:', 'Item Price Qty Total',
  'Choice Full Size 19 Gauge 18" x 26" Wire in Rim Aluminum Bun / Sheet Pan -', '12/Case $64.49 3 $193.47',
  '407BPFBULK12', 'KIT', 'Sub Total: $193.47', 'Shipping & Handling: $0.00', 'Estimated Tax: $20.31', 'Total: $213.78',
  'Thank you again for shopping at WebstaurantStore!', 'Print this page'];
test('Webstaurant order confirmation imports one item, three cases, twelve per case; no fabricated delivery', () => {
  const result = parseWebstaurantOrder(lines, context.parseAmazonDate);
  assert.equal(result.date_ordered, '2026-11-24');
  assert.equal(result.order_number, '123456789');
  assert.equal(result.items.length, 1);
  const item = result.items[0];
  assert.equal(item.item_name, 'Choice Full Size 19 Gauge 18" x 26" Wire in Rim Aluminum Bun / Sheet Pan - 12/Case');
  assert.equal(item.package_qty, 3); assert.equal(item.units_per_package, 12);
  assert.equal(item.item_supplier, 'WebstaurantStore');
  assert.equal(item.expected_delivery_date, ''); assert.equal(item.received_date, '');
  assert.equal(item.import_needs_delivery_date, 1);
});
test('multiple products exclude SKU badges and totals; explicit delivery dates are respected', () => {
  const multiple = [...lines.slice(0, 11), 'Second Product - 6/Pack $20.00 2 $40.00', 'SKU123', ...lines.slice(11), 'Expected Delivery: November 30, 2026'];
  const result = parseWebstaurantOrder(multiple, context.parseAmazonDate);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[1].item_name, 'Second Product - 6/Pack');
  assert.equal(result.items[1].package_qty, 2);
  assert.equal(result.items[1].units_per_package, 6);
  assert.equal(result.items[1].expected_delivery_date, '2026-11-30');
  assert.equal(result.items[1].received_date, '');
  assert.equal(parseWebstaurantOrder([...lines, 'Delivered: November 30, 2026'], context.parseAmazonDate).items[0].received_date, '2026-11-30');
});
test('known but unrecognized Webstaurant layout returns no items instead of generic address/noise imports', () => {
  assert.equal(parseWebstaurantOrder(['WebstaurantStore', 'Order Number: 1'], context.parseAmazonDate).items.length, 0);
  assert.equal(parseWebstaurantOrder(['Other supplier'], context.parseAmazonDate), null);
});
test('existing Amazon invoice and generic invoice parsing are retained', () => {
  const amazon = context.parseAmazonOrderPdf(null, ['Order Placed: November 24, 2026', 'Order # 111-2222222-3333333', 'Items Ordered', 'Price', '2 of:', 'Storage Containers', 'Sold by: Seller', 'Shipping Address']);
  assert.equal(amazon.items.length, 1); assert.equal(amazon.items[0].package_qty, 2);
  assert.equal(amazon.items[0].item_name, 'Storage Containers'); assert.equal(amazon.items[0].item_supplier, 'Seller');
  const generic = context.parseAmazonOrderPdf(null, ['Invoice Date: November 24, 2026', 'Invoice #', 'X123', 'Mixing bowls Qty: 4']);
  assert.equal(generic.items[0].item_name, 'Mixing bowls'); assert.equal(generic.items[0].package_qty, 4);
});
test('invalid PDF rejects without falling through to item creation', async () => {
  await assert.rejects(readOrderPdfLines(Buffer.from('not a PDF')));
});
test('upload handler saves case size and keeps pending deliveries unreceived', async () => {
  const inserts = [], alerts = [];
  const routeContext = { ...context, Buffer,
    extractPdfTextLines: () => [],
    require: () => ({ parseWebstaurantOrder, readOrderPdfLines: async () => lines }),
    isIsoDate: value => /^\d{4}-\d{2}-\d{2}$/.test(value),
    withTransaction: async fn => fn({}),
    runSql: async (sql, values) => { inserts.push({sql,values}); return { lastID: 1 }; },
    createDeliveryAddedAlert: async (id, options) => alerts.push(options),
    createDeliveryScheduledAlert: async () => { throw Error('Should not schedule missing date'); }, console
  };
  vm.createContext(routeContext);
  vm.runInContext(source.slice(source.indexOf('async function importOrderedItemsPdf('), source.indexOf('app.post("/ordered-items/import-pdf"')), routeContext);
  let status, result;
  await routeContext.importOrderedItemsPdf({query:{department:'Kitchen'},headers:{},body:Buffer.from('fixture')}, {
    status(value){status=value;return this;},json(value){result=value;},send(value){throw Error(value);}
  });
  assert.equal(status,201); assert.equal(result.needs_delivery_date,1); assert.equal(result.received,0);
  assert.equal(inserts.length,1);
  assert.match(inserts[0].sql,/package_qty,\s+units_per_package/);
  assert.equal(inserts[0].values.length,11);
  assert.equal(inserts[0].values[4],3); assert.equal(inserts[0].values[5],12);
  assert.equal(inserts[0].values[8],null); assert.equal(alerts[0].needsDeliveryDate,true);
});
