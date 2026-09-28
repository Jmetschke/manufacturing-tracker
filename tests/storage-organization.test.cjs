const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const create=require('../server/storage-organization');
async function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE storage_locations(id INTEGER PRIMARY KEY,name TEXT,deleted INTEGER DEFAULT 0);
 CREATE TABLE standard_items(id INTEGER PRIMARY KEY,name TEXT);
 CREATE TABLE storage_items(id INTEGER PRIMARY KEY,location_id INTEGER,item_name TEXT,standard_item_id INTEGER,quantity REAL,unit TEXT,placed_at TEXT);
 CREATE TABLE ordered_items(id INTEGER PRIMARY KEY,item_name TEXT,package_qty REAL,units_per_package INTEGER,received_date TEXT,received_location TEXT);
 CREATE TABLE storage_delivery_placements(ordered_item_id INTEGER PRIMARY KEY,location_id INTEGER);
 CREATE TABLE storage_delivery_quantities(ordered_item_id INTEGER PRIMARY KEY,quantity REAL,units_per_package INTEGER);
 INSERT INTO storage_locations VALUES(1,'Kitchen',0),(2,'Vault',0);
 INSERT INTO storage_items VALUES(1,1,'Mixer',NULL,1,'units','2026-09-01');
 INSERT INTO ordered_items VALUES(1,'Flour',3,10,'2026-09-02','Kitchen');`);
 const service=create({runSql:async(s,a=[])=>db.prepare(s).run(...a),getSql:async(s,a=[])=>db.prepare(s).get(...a),allSql:async(s,a=[])=>db.prepare(s).all(...a),withTransaction:async fn=>{db.exec('BEGIN');try{const r=await fn(db);db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}});
 await service.initialize();return {db,service};
}
test('classification is per item/source, validated and follows moves',async()=>{
 const {db,service}=await setup();try{
 assert.equal((await service.enrich([{id:1,source:'manual'}]))[0].category,null);
 await service.classify('manual',1,'Equipment');await service.classify('delivery',1,'Ingredients');
 db.exec('UPDATE storage_items SET location_id=2 WHERE id=1');
 assert.deepEqual((await service.enrich([{id:1,source:'manual'},{id:1,source:'delivery'}])).map(r=>r.category),['Equipment','Ingredients']);
 await assert.rejects(service.classify('manual',1,'invalid'),/Choose/);
 await service.classify('manual',1,null);assert.equal((await service.enrich([{id:1,source:'manual'}]))[0].category,null);
 }finally{db.close();}
});
test('archive preserves actual last room and receipt, removes listing, survives source and room deletion',async()=>{
 const {db,service}=await setup();try{
 await service.classify('delivery',1,'Ingredients');
 db.exec('INSERT INTO storage_delivery_placements VALUES(1,2); INSERT INTO storage_delivery_quantities VALUES(1,2,8)');
 await service.archive('delivery',1);
 const archived=(await service.archives())[0];assert.equal(archived.last_location,'Vault');assert.equal(archived.received_at,'2026-09-02');assert.equal(archived.category,'Ingredients');assert.ok(archived.archived_at);
 assert.equal(db.prepare('SELECT location_id FROM storage_delivery_placements').get().location_id,null);
 assert.equal(db.prepare('SELECT count(*) n FROM ordered_items').get().n,1);
 const snapshot=JSON.parse(db.prepare('SELECT snapshot FROM storage_item_archives').get().snapshot);assert.equal(snapshot.quantity,2);assert.equal(snapshot.current_units_per_package,8);
 await assert.rejects(service.archive('delivery',1),/no longer/);
 db.exec('DELETE FROM ordered_items; DELETE FROM storage_locations WHERE id=2');assert.equal((await service.archives())[0].last_location,'Vault');
 await service.archive('manual',1);const manual=(await service.archives()).find(r=>r.source==='manual');assert.equal(manual.received_at,null);assert.equal(manual.placed_at,'2026-09-01');assert.equal(db.prepare('SELECT count(*) n FROM storage_items').get().n,0);
 }finally{db.close();}
});
test('archive failure leaves inventory and history unchanged',async()=>{
 const {db,service}=await setup();try{
 db.exec("CREATE TRIGGER fail_archive BEFORE DELETE ON storage_items BEGIN SELECT RAISE(ABORT,'forced failure'); END");
 await assert.rejects(service.archive('manual',1),/forced failure/);
 assert.equal((await service.archives()).length,0);assert.equal(db.prepare('SELECT count(*) n FROM storage_items').get().n,1);
 }finally{db.close();}
});
