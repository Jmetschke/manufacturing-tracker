const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const createInventory = require('../server/equipment-inventory');
async function setup() {
  const database = new DatabaseSync(':memory:');
  database.exec(`CREATE TABLE ordered_items (id INTEGER PRIMARY KEY AUTOINCREMENT, date_ordered TEXT,
    expected_delivery_date TEXT, item_name TEXT, item_company TEXT, package_qty INTEGER, units_per_package INTEGER,
    item_supplier TEXT, department TEXT, requested_by TEXT, received_by TEXT, received_date TEXT, received_time TEXT, received_location TEXT,
    received_notes TEXT, received_image_1 TEXT, received_image_2 TEXT, import_needs_delivery_date INTEGER DEFAULT 0, updated_at TEXT);
    CREATE TABLE storage_locations(id INTEGER PRIMARY KEY, name TEXT UNIQUE COLLATE NOCASE, deleted INTEGER DEFAULT 0);
    CREATE TABLE storage_items(id INTEGER PRIMARY KEY AUTOINCREMENT, location_id INTEGER, item_name TEXT, quantity REAL, unit TEXT, notes TEXT, placed_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE storage_delivery_placements(ordered_item_id INTEGER PRIMARY KEY, location_id INTEGER);
    INSERT INTO storage_locations VALUES(1,'Room A',0),(2,'Room B',0);
    INSERT INTO ordered_items(item_name,item_supplier,package_qty) VALUES('Existing description','Old vendor',2);
    INSERT INTO storage_items(location_id,item_name,quantity,unit) VALUES(1,'Legacy manual',3,'boxes');`);
  const runSql = async (sql, args = []) => { const result = database.prepare(sql).run(...args); return { ...result, lastID: Number(result.lastInsertRowid) }; };
  const allSql = async (sql, args = []) => database.prepare(sql).all(...args);
  const getSql = async (sql, args = []) => database.prepare(sql).get(...args);
  const addMissingColumn = async (table, column, type) => {
    if (!database.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  };
  const withTransaction = async fn => { database.exec('BEGIN'); try { const result = await fn(); database.exec('COMMIT'); return result; } catch (err) { database.exec('ROLLBACK'); throw err; } };
  const inventory = createInventory({ runSql, allSql, getSql, addMissingColumn, withTransaction });
  await inventory.initialize(); await inventory.initialize();
  const routes = {};
  const app = Object.fromEntries(['get','post','put','delete'].map(method => [method, (path, fn) => { routes[`${method} ${path}`] = fn; }]));
  inventory.register(app);
  const source = fs.readFileSync('server.js','utf8');
  const context = { app, inventory, runSql, allSql, getSql, withTransaction, Buffer, console,
    isIsoDate: value => /^\d{4}-\d{2}-\d{2}$/.test(value), normalizeRequiredText: value => String(value || '').trim(), normalizeOptionalText: value => String(value || '').trim(), normalizeOrderedItemImages: () => [null,null],
    parseAmazonOrderPdf: () => ({ date_ordered:'2026-09-24', item_company:'Invoice 123', items:[{item_name:'ULINE H-1045BL  WIRE SHELVING UNIT',item_supplier:'ULINE',package_qty:5,expected_delivery_date:'2026-09-25',import_needs_delivery_date:0}] }),
    createDeliveryAddedAlert: async()=>{}, createDeliveryScheduledAlert:async()=>{},
    db: { run(sql,args,callback) { try { const result=database.prepare(sql).run(...args); callback.call({...result,lastID:Number(result.lastInsertRowid)},null); } catch(err){callback(err);} } }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function importOrderedItemsPdf('), source.indexOf('app.post("/ordered-items/import-pdf"')), context);
  routes.import = context.importOrderedItemsPdf;
  vm.runInContext(source.slice(source.indexOf('app.post("/ordered-items/received"'),source.indexOf('app.put("/ordered-items/:id/receive"')),context);
  vm.runInContext(source.slice(source.indexOf('app.put("/ordered-items/:id/receive"'),source.indexOf('app.put("/ordered-items/:id/undo-receive"')),context);
  vm.runInContext(source.slice(source.indexOf('app.get("/storage-locations"'),source.indexOf('// A null delivery placement')),context);
  async function call(route, body={}, params={}) {
    let status=200,data;
    const req={body,params,query:{department:'Kitchen'},headers:{}};
    await routes[route](req,{ status(value){status=value;return this;},json(value){data=value;},send(value){data=value;} });
    return {status,data};
  }
  return {database, inventory, call};
}
test('import, mapping, receiving and room adjustments preserve source data and quantities', async()=>{
  const {database:db,inventory,call}=await setup();
  assert.equal(db.prepare('SELECT original_description FROM ordered_items WHERE id=1').get().original_description,'Existing description');
  let response=await call('import',Buffer.from('test PDF')); assert.equal(response.status,201);
  let groups=(await call('get /admin/inventory/mappings')).data.unmapped;
  assert.equal(groups.some(g=>g.vendor==='ULINE'),true);
  const standard=(await call('post /inventory/standard-items',{name:'Wire Shelving Unit'})).data;
  assert.equal((await call('post /inventory/standard-items',{name:'wire shelving unit'})).data.id,standard.id);
  const description='ULINE H-1045BL  WIRE SHELVING UNIT';
  await call('post /admin/inventory/mappings',{vendor:'ULINE',description,standard_item_id:standard.id});
  await call('import',Buffer.from('repeat PDF'));
  let mapped=db.prepare(`SELECT id, ${inventory.orderColumns()} FROM ordered_items WHERE item_supplier='ULINE'`).all();
  assert.equal(mapped.length,2); assert.equal(mapped.every(row=>row.standard_item_name==='Wire Shelving Unit'),true);
  db.prepare('INSERT INTO ordered_items(item_name,item_supplier,package_qty) VALUES(?,?,?)').run('Global Chrome Shelf','Global',1);
  await call('post /admin/inventory/mappings',{vendor:'Global',description:'Global Chrome Shelf',standard_item_id:standard.id});
  const id=mapped[0].id;
  response=await call('put /ordered-items/:id/receive',{received_date:'2026-09-24',received_location:'Room A',received_by:'Jennifer',units_per_package:4},{id});assert.equal(response.status,200);
  assert.equal(db.prepare('SELECT received_by FROM ordered_items WHERE id=?').get(id).received_by,'Jennifer');
  let rooms=(await call('get /storage-locations')).data;
  let received=rooms[0].items.find(item=>item.source==='delivery'&&item.id===id);
  assert.equal(received.standard_item_name,'Wire Shelving Unit');assert.equal(received.quantity,5);assert.equal(received.units_per_package,4);
  response=await call('post /storage-items',{location_id:1,item_name:'Wire Shelving Unit',standard_item_id:standard.id,quantity:2,unit:'packages',units_per_package:null});assert.equal(response.status,201);
  response=await call('post /storage-items/:source/:id/inventory',{quantity:3,units_per_package:2},{source:'delivery',id});assert.equal(response.status,200);
  let ordered=db.prepare('SELECT * FROM ordered_items WHERE id=?').get(id);assert.equal(ordered.package_qty,5);assert.equal(ordered.units_per_package,4);
  db.prepare('INSERT INTO storage_delivery_placements VALUES(?,2)').run(id);
  received=(await call('get /storage-locations')).data[1].items.find(item=>item.id===id);
  assert.equal(received.quantity,3);assert.equal(received.units_per_package,2);
  await call('post /storage-items/:source/:id/inventory',{quantity:3,units_per_package:null},{source:'delivery',id});
  received=(await call('get /storage-locations')).data[1].items.find(item=>item.id===id);assert.equal(received.units_per_package,null);
  const changed=(await call('post /inventory/standard-items',{name:'Storage Rack'})).data;
  await call('post /admin/inventory/mappings',{vendor:'ULINE',description,standard_item_id:changed.id});
  assert.equal((await call('get /storage-locations')).data[1].items.find(item=>item.id===id).standard_item_name,'Storage Rack');
  db.prepare('UPDATE ordered_items SET item_name=? WHERE id=?').run('Edited display name',id);
  assert.equal(db.prepare('SELECT original_description FROM ordered_items WHERE id=?').get(id).original_description,description);
  assert.throws(()=>db.prepare('UPDATE ordered_items SET original_description=? WHERE id=?').run('Changed source',id),/cannot be overwritten/);
  const alias=db.prepare("SELECT id FROM item_aliases WHERE vendor_key='uline'").get();
  await call('delete /admin/inventory/mappings/:id',{}, {id:alias.id});
  assert.equal((await call('get /storage-locations')).data[1].items.find(item=>item.id===id).standard_item_name,null);
  assert.equal(db.prepare('SELECT count(*) n FROM ordered_items').get().n,4);
  assert.equal((await call('post /storage-items/:source/:id/inventory',{quantity:2,units_per_package:-1},{source:'delivery',id})).status,400);
  // Optional receiving values stay unknown; omitted values preserve existing package information.
  const second=mapped[1].id;
  response=await call('put /ordered-items/:id/receive',{received_date:'2026-09-24',received_location:'Room A',units_per_package:null},{id:second});
  assert.equal(response.status,200);assert.equal(db.prepare('SELECT units_per_package FROM ordered_items WHERE id=?').get(second).units_per_package,null);
  db.prepare('UPDATE ordered_items SET units_per_package=7 WHERE id=?').run(second);
  await call('put /ordered-items/:id/receive',{received_date:'2026-09-24',received_location:'Room A'},{id:second});
  assert.equal(db.prepare('SELECT units_per_package FROM ordered_items WHERE id=?').get(second).units_per_package,7);
  const manual=db.prepare('SELECT id FROM storage_items WHERE standard_item_id=?').get(standard.id);
  await call('post /storage-items/:source/:id/inventory',{quantity:0,units_per_package:6,standard_item_id:standard.id},{source:'manual',id:manual.id});
  await call('put /admin/inventory/standard-items/:id',{name:'Standard Shelf'},{id:standard.id});
  const manualView=(await call('get /storage-locations')).data[0].items.find(item=>item.source==='manual'&&item.id===manual.id);
  assert.equal(manualView.standard_item_name,'Standard Shelf');assert.equal(manualView.quantity,0);assert.equal(manualView.units_per_package,6);
  assert.throws(()=>db.prepare('UPDATE ordered_items SET original_supplier=? WHERE id=?').run('Changed vendor',id),/cannot be overwritten/);
  assert.equal(db.prepare('SELECT item_name FROM storage_items WHERE id=1').get().item_name,'Legacy manual');
  response=await call('post /ordered-items/received',{date_ordered:'2026-09-25',expected_delivery_date:'2026-09-25',received_date:'2026-09-25',received_location:'Room A',received_by:'Alex',item_name:'Manual received',item_supplier:'Supplier',department:'Kitchen',package_qty:1});
  assert.equal(response.status,201);assert.equal(db.prepare('SELECT received_by FROM ordered_items WHERE id=?').get(response.data.id).received_by,'Alex');
  const countBefore=db.prepare('SELECT count(*) n FROM ordered_items').get().n;
  const receipt={date_ordered:'2026-09-25',expected_delivery_date:'2026-09-25',received_date:'2026-09-25',received_location:'Room A',received_by:'Alex',item_supplier:'Supplier',department:'Kitchen'};
  response=await call('post /ordered-items/received',{...receipt,items:[{item_name:'Batch 1',package_qty:2,units_per_package:4},{item_name:'Batch 2',package_qty:3,units_per_package:null}]});
  assert.equal(response.status,201);assert.equal(response.data.ids.length,2);
  assert.equal(db.prepare('SELECT count(*) n FROM ordered_items').get().n,countBefore+2);
  response=await call('post /ordered-items/received',{...receipt,items:[{item_name:'Valid',package_qty:1},{item_name:'Invalid',package_qty:-1}]});
  assert.equal(response.status,400);assert.equal(db.prepare('SELECT count(*) n FROM ordered_items').get().n,countBefore+2);
  db.close();
});
