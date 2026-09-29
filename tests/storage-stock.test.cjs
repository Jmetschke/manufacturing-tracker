const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
async function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE ordered_items(id INTEGER PRIMARY KEY AUTOINCREMENT,item_name TEXT,original_description TEXT,original_supplier TEXT,package_qty REAL,units_per_package INTEGER,received_date TEXT,received_location TEXT);
 CREATE TABLE storage_locations(id INTEGER PRIMARY KEY,name TEXT,deleted INTEGER DEFAULT 0);
 CREATE TABLE storage_items(id INTEGER PRIMARY KEY AUTOINCREMENT,location_id INTEGER,item_name TEXT,quantity REAL,unit TEXT,standard_item_id INTEGER,units_per_package INTEGER,notes TEXT,placed_at TEXT DEFAULT (datetime('now')));
 CREATE TABLE standard_items(id INTEGER PRIMARY KEY,name TEXT);
 CREATE TABLE item_aliases(standard_item_id INTEGER,vendor_key TEXT,description_key TEXT);
 CREATE TABLE storage_delivery_placements(ordered_item_id INTEGER PRIMARY KEY,location_id INTEGER);
 CREATE TABLE storage_delivery_quantities(ordered_item_id INTEGER PRIMARY KEY,quantity REAL,units_per_package INTEGER);
 CREATE TABLE storage_item_categories(source TEXT,item_id INTEGER,category TEXT,PRIMARY KEY(source,item_id));
 INSERT INTO storage_locations VALUES(1,'Kitchen',0),(2,'Vault',0);
 INSERT INTO standard_items VALUES(1,'Widgets'),(2,'Other');
 INSERT INTO item_aliases VALUES(1,'vendor','widget box');
 INSERT INTO ordered_items VALUES(1,'Widget box','Widget box','Vendor',5,10,'2026-09-01','Kitchen');`);
 const service=require('../server/storage-stock')({runSql:async(s,a=[])=>{const r=db.prepare(s).run(...a);return {lastID:Number(r.lastInsertRowid),changes:Number(r.changes)};},getSql:async(s,a=[])=>db.prepare(s).get(...a),allSql:async(s,a=[])=>db.prepare(s).all(...a),withTransaction:async fn=>{db.exec('BEGIN');try{const r=await fn(db);db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}});
 await service.initialize();return {db,service};
}
test('mapped receipt archives original quantities, credits adjusted stock once, then preserves receipt through consumption and replenishment',async()=>{
 const {db,service}=await setup();try{
 db.exec('INSERT INTO storage_delivery_quantities VALUES(1,3,10)');
 await service.reconcile();await service.reconcile();
 let stock=db.prepare('SELECT * FROM storage_items').get();assert.equal(stock.quantity,30);assert.equal(stock.unit,'units');
 let receipts=await service.receipts();assert.equal(receipts.length,1);assert.equal(receipts[0].original_quantity,5);assert.equal(receipts[0].original_units_per_package,10);assert.equal(receipts[0].credited_quantity,30);
 const snapshot=db.prepare('SELECT snapshot FROM storage_stock_receipts').get().snapshot;
 await service.adjust(stock.id,{quantity:12,expected_quantity:30});
 await assert.rejects(service.adjust(stock.id,{quantity:9,expected_quantity:30}),/Stock changed/);
 db.exec("INSERT INTO ordered_items(item_name,original_description,original_supplier,package_qty,units_per_package,received_date,received_location) VALUES('Widget box','Widget box','Vendor',2,10,'2026-09-29','Kitchen')");
 await service.reconcile();stock=db.prepare('SELECT * FROM storage_items').get();assert.equal(stock.quantity,32);
 assert.equal(db.prepare('SELECT snapshot FROM storage_stock_receipts WHERE id=1').get().snapshot,snapshot);
 assert.equal(db.prepare('SELECT package_qty FROM ordered_items WHERE id=1').get().package_qty,5);
 assert.equal(db.prepare('SELECT count(*) n FROM storage_items').get().n,1);
 db.exec("UPDATE item_aliases SET standard_item_id=2; DELETE FROM ordered_items WHERE id=1");await service.reconcile();
 assert.equal(db.prepare('SELECT standard_item_id FROM storage_items').get().standard_item_id,1);assert.equal((await service.receipts()).length,2);
 }finally{db.close();}
});
test('manual original survives reductions before mapping; unknown package counts are not combined with individual units',async()=>{
 const {db,service}=await setup();try{
 db.exec("INSERT INTO storage_items(location_id,item_name,quantity,unit,units_per_package) VALUES(1,'Manual boxes',4,'boxes',5)");
 db.exec('UPDATE storage_items SET quantity=2,standard_item_id=1');
 await service.reconcile();const manual=(await service.receipts()).find(r=>r.source==='manual');
 assert.equal(manual.original_quantity,4);assert.equal(manual.credited_quantity,10);
 assert.equal(db.prepare('SELECT quantity FROM storage_items').get().quantity,60);
 db.exec("INSERT INTO ordered_items(item_name,original_description,original_supplier,package_qty,received_date,received_location) VALUES('Widget box','Widget box','Vendor',2,'2026-09-29','Kitchen')");
 await service.reconcile();assert.equal(db.prepare('SELECT count(*) n FROM storage_items').get().n,2);
 assert.equal(db.prepare("SELECT quantity FROM storage_items WHERE unit='packages'").get().quantity,2);
 }finally{db.close();}
});
test('conversion rollback keeps source in room; balance movement merges compatible stock without changing receipt location',async()=>{
 const {db,service}=await setup();try{
 db.exec("CREATE TRIGGER test_failure BEFORE INSERT ON storage_stock_receipts BEGIN SELECT RAISE(ABORT,'test failure'); END");
 await assert.rejects(service.reconcile(),/test failure/);assert.equal(db.prepare('SELECT count(*) n FROM storage_items').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM storage_delivery_placements').get().n,0);
 db.exec('DROP TRIGGER test_failure');await service.reconcile();
 db.exec("UPDATE storage_items SET location_id=2; INSERT INTO storage_items(location_id,item_name,quantity,unit,standard_item_id) VALUES(1,'Loose widgets',4,'ea',1)");await service.reconcile();
 db.exec('UPDATE storage_items SET location_id=2');await service.reconcile();
 assert.equal(db.prepare('SELECT count(*) n FROM storage_items').get().n,1);assert.equal(db.prepare('SELECT quantity FROM storage_items').get().quantity,54);
 assert.ok((await service.receipts()).every(r=>r.last_location==='Kitchen'));
 assert.equal(new Set((await service.receipts()).map(r=>r.stock_id)).size,1);
 }finally{db.close();}
});
