const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const create = require('../server/current-packages');
const headers = ['Quantity','Item','Tag','Production Batch Number','Source Production Batch','Location','Unit Of Measure','Expiration Date','Use-By Date','Packaged Date','Source Package(s)'];
const row = (tag, quantity=600, batch='Batch A', source='', expiration='2026-10-10', item='Item A', parent='') => [quantity,item,tag,batch,source,'Production','ea',expiration,'','2026-07-22',parent];
async function setup() {
  const db = new DatabaseSync(':memory:');
  let input;
  const helpers = {
    runSql: async(sql,args=[])=>{const r=db.prepare(sql).run(...args);return {lastID:Number(r.lastInsertRowid)};},
    allSql: async(sql,args=[])=>db.prepare(sql).all(...args),
    getSql: async(sql,args=[])=>db.prepare(sql).get(...args),
    withTransaction: async fn=>{db.exec('BEGIN');try { const result=await fn(db);db.exec('COMMIT');return result; }catch(e){db.exec('ROLLBACK');throw e;}},
    readWorkbook: async()=>input
  };
  const service=create(helpers); await service.initialize();
  async function preview(rows) {input=[headers,...rows];return service.preview(Buffer.from('test'),'report.xlsx');}
  async function apply(rows) {const p=await preview(rows);await service.apply(p.token,true);return p;}
  return {db,service,helpers,preview,apply};
}
test('header-based classification, lineage, review, and strict import validation',()=>{
  const records=create.parseRows([['Report title'],headers,row('A'),row('B',20,'','source','','Item A','A'),row('C',10,'','','')]);
  assert.equal(records[0].automatic_classification,'MASTER');
  assert.equal(records[1].automatic_classification,'SPLIT');
  assert.match(records[1].classification_reason,/same Item/);
  assert.deepEqual(create.sourceTags(records[1]),['A']);
  assert.equal(records[2].automatic_classification,'REVIEW');
  assert.throws(()=>create.parseRows([['Tag','Item']]),/Missing required/);
  assert.throws(()=>create.parseRows([headers]),/no packages/);
  assert.throws(()=>create.parseRows([headers,row('A'),row('A')]),/Duplicate Tag/);
  assert.throws(()=>create.parseRows([headers,row('A',-1)]),/Invalid quantity/);
  assert.throws(()=>create.parseRows([headers,row('A',20,'Batch','','2026-02-30')]),/Invalid date/);
  assert.equal(create.parseRows([headers,row('A',0)])[0].quantity,0);
});
test('snapshot lifecycle updates quantity, adds, retires, preserves history and reactivates one record',async()=>{
  const {db,service,apply,preview}=await setup();
  try {
    await apply([row('A'),row('B',900,'Batch B','','2026-11-15'),row('split',10,'','source','','Item A','A')]);
    assert.deepEqual((await service.list(true)).map(p=>p.tag),['A','B']);
    const first=(await service.list()).find(p=>p.tag==='A').first_seen_at;
    const pending=await preview([row('A',125),row('B',900,'Batch B','','2026-11-15'),row('C',1200,'Batch C','','2026-12-20')]);
    assert.equal((await service.list()).find(p=>p.tag==='A').quantity,600,'preview does not write');
    assert.equal(pending.summary.quantity_changes,1);
    await service.apply(pending.token,true);
    assert.equal((await service.list()).find(p=>p.tag==='A').quantity,125);
    await apply([row('B',900,'Batch B','','2026-11-15'),row('C',1200,'Batch C','','2026-12-20')]);
    const retired=(await service.list()).find(p=>p.tag==='A');
    assert.equal(retired.active,0);assert.equal(retired.quantity,125);assert.equal(retired.item_key,'item a');assert.ok(retired.retired_at);
    assert.deepEqual((await service.list(true)).map(p=>p.tag),['B','C']);
    await apply([row('A',100)]);
    const restored=(await service.list()).find(p=>p.tag==='A');
    assert.equal(restored.active,1);assert.equal(restored.first_seen_at,first);assert.equal(restored.retired_at,null);
    assert.equal(db.prepare("SELECT count(*) AS n FROM metrc_packages WHERE tag='A'").get().n,1);
    const events=db.prepare("SELECT event FROM package_history WHERE tag='A'").all().map(h=>h.event);
    assert.deepEqual(events,['added','updated','retired','reactivated']);
  } finally {db.close();}
});
test('persistent overrides, restore automatic classification and manual reactivation',async()=>{
  const {db,service,apply}=await setup();try{
    await apply([row('review',20,'','',''),row('master')]);
    await service.change('review','MASTER',false);
    await apply([row('review',10,'','',''),row('master')]);
    assert.ok((await service.list(true)).some(p=>p.tag==='review'));
    await service.change('review','IGNORED',false);
    await apply([row('review',8,'','',''),row('master')]);
    assert.equal((await service.list()).find(p=>p.tag==='review').classification,'IGNORED');
    await service.change('review','AUTO',false);
    assert.equal((await service.list()).find(p=>p.tag==='review').classification,'REVIEW');
    await apply([row('master')]);
    await service.change('review','MASTER',true);
    assert.equal((await service.list()).find(p=>p.tag==='review').active,1);
  }finally{db.close();}
});
test('FEFO ordering and explicit use-by / packaged fallback do not depend on report row order',()=>{
  const input=[row('late',1,'batch','','2027-01-01'),row('early',1,'batch','','2026-10-01'),row('useby',1,'batch','',''),row('old',1,'batch','',''),row('new',1,'batch','','')];
  input[2][8]='2026-09-30'; input[3][9]='2025-01-01';input[4][9]='2026-01-01';
  const sorted=create.parseRows([headers,...input]).sort(create.compare);
  assert.deepEqual(sorted.map(p=>p.tag),['useby','early','late','old','new']);
  assert.equal(sorted[3].expiration_date,null);
});
test('invalid, abandoned, stale, all-retiring and failed transactional imports are safe',async()=>{
  const {db,service,apply,preview}=await setup();try{
    await apply([row('A')]);
    await assert.rejects(preview([]),/no packages/);
    const abandoned=await preview([row('B')]);
    assert.equal((await service.list(true))[0].tag,'A');
    await service.change('A','MASTER',false);
    await assert.rejects(service.apply(abandoned.token,true),/changed after/);
    const noMasters=await preview([row('split',10,'','source')]);
    assert.equal(noMasters.all_masters_retiring,true);
    await assert.rejects(service.apply(noMasters.token,false),/every master/);
    assert.equal((await service.list(true))[0].tag,'A');
    const good=await preview([row('B')]);
    db.exec("CREATE TRIGGER test_failure BEFORE INSERT ON package_history BEGIN SELECT RAISE(ABORT,'test failure'); END");
    await assert.rejects(service.apply(good.token,true),/test failure/);
    assert.deepEqual((await service.list(true)).map(p=>p.tag),['A']);
    assert.equal(db.prepare('SELECT count(*) AS n FROM package_imports').get().n,1);
    db.exec('DROP TRIGGER test_failure');
    await service.apply(good.token,true);
    assert.deepEqual((await service.list(true)).map(p=>p.tag),['B']);
  }finally{db.close();}
});
test('admin routes enforce access; employee route excludes split/review/ignored/retired packages',async()=>{
  const {db,service,apply}=await setup();try{
    await apply([row('A'),row('split',1,'','source'),row('review',1,'','','')]);
    const routes=[];
    const app=Object.fromEntries(['get','post'].map(method=>[method,(path,...handlers)=>routes.push({method,path,handler:handlers.at(-1)})]));
    service.register(app,()=>{},(req,res)=>{res.status(403);return false;});
    for(const route of routes.filter(r=>r.path!=='/current-packages')){
      let code=200,json;
      await route.handler({}, {status(n){code=n;return this;},json(v){json=v;}});
      assert.equal(code,403,route.path);assert.equal(json,undefined);
    }
    let result;await routes.find(r=>r.path==='/current-packages').handler({}, {json(v){result=v;}});
    assert.deepEqual(result.map(p=>p.tag),['A']);
  }finally{db.close();}
});
test('administrator history resolves lineage and preserves earlier import quantities',async()=>{
  const {db,service,apply}=await setup();try{
    await apply([row('A',600),row('child',10,'','source','','Item A','A')]);
    await apply([row('A',125)]);
    const routes={};
    const app=Object.fromEntries(['get','post'].map(method=>[method,(path,...handlers)=>{routes[`${method} ${path}`]=handlers.at(-1);} ]));
    service.register(app,()=>{},()=>true);
    let result;
    const response={json(value){result=value;},status(){return this;}};
    await routes['get /current-packages/:tag/history']({params:{tag:'A'}},response);
    assert.equal(result.children[0].tag,'child');
    assert.deepEqual(result.history.map(h=>JSON.parse(h.snapshot).quantity),[125,600]);
    await routes['get /current-packages/:tag/history']({params:{tag:'child'}},response);
    assert.equal(result.parents[0].tag,'A');
    await routes['get /current-packages/imports/:id/packages']({params:{id:'1'}},response);
    assert.equal(result.find(p=>p.tag==='A').quantity,600);
    assert.equal((await service.list(true))[0].quantity,125);
  }finally{db.close();}
});
