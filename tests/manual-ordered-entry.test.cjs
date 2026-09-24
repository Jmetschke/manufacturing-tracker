const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('regular and admin manual orders share one validated creation handler',async()=>{
 const source=fs.readFileSync('server.js','utf8');let handler,paths;const inserts=[];
 vm.runInNewContext(source.slice(source.indexOf('app.post(["/admin/ordered-items"'),source.indexOf('app.put("/ordered-items/:id",')),{
 app:{post:(routes,fn)=>{paths=routes;handler=fn;}},normalizeRequiredText:v=>String(v??'').trim(),isIsoDate:v=>/^\d{4}-\d{2}-\d{2}$/.test(v),
 withTransaction:async fn=>fn({}),runSql:async(sql,args)=>{inserts.push({sql,args});return{lastID:inserts.length};},
 createDeliveryAddedAlert:async()=>{},createDeliveryScheduledAlert:async()=>{},console
 });
 assert.equal(paths.includes('/ordered-items'),true);assert.equal(paths.includes('/admin/ordered-items'),true);
 let status=200,data;const res={status(v){status=v;return this;},json(v){data=v;},send(v){data=v;}};
 const body={date_ordered:'2026-09-24',expected_delivery_date:'2026-09-28',item_name:'Shelves',package_qty:2,item_supplier:'Supplier',department:'Kitchen'};
 await handler({body},res);assert.equal(status,201);assert.equal(inserts.length,1);assert.equal(inserts[0].args[2],'Shelves');assert.equal(inserts[0].args[4],2);assert.doesNotMatch(inserts[0].sql,/received_date/);
 await handler({body:{...body,expected_delivery_date:''}},res);assert.equal(status,400);assert.equal(inserts.length,1);
});
