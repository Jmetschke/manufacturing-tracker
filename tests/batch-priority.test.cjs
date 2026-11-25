const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {updateBatchPriority}=require('../server/batch-priority');
const moveBatch=require('../server/move-calendar-batch');
test('priority updates only the selected batch and survives moving',()=>{
 const payload={batchHijnx:[{item:'A',metrc_number:'001'},{item:'A'}],batchSb:[{item:'A'}]};
 const input={batchType:'hijnx',batchIndex:0,item:'A',priority:1};
 updateBatchPriority(payload,input);assert.equal(payload.batchHijnx[0].priority,1);assert.equal(payload.batchHijnx[1].priority,undefined);
 const target={};moveBatch(payload,target,{...input,sourceDate:'2026-11-25',targetDate:'2026-11-26'});
 assert.equal(target.batchHijnx[0].priority,1);assert.equal(target.batchHijnx[0].metrc_number,'001');
 for(const priority of [0,4,'1',null,1.5])assert.throws(()=>updateBatchPriority(target,{...input,priority}),{status:400});
 assert.throws(()=>updateBatchPriority(target,{...input,item:'wrong'}),{status:409});
});
test('calendar-day age boundaries exactly match all requested color ranges',()=>{
 const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/batch-priority.js','utf8'),ctx);
 for(const [days,color] of [[-1,'neutral'],[0,'neutral'],[1,'green'],[3,'green'],[5,'green'],[6,'yellow'],[8,'yellow'],[9,'orange'],[12,'orange'],[13,'red'],[100,'red']]){
  const today=new Date(2026,10,13),start=new Date(2026,10,13-days);
  const date=`${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
  const result=ctx.getBatchAge(date,today);assert.equal(result.days,days);assert.equal(result.color,color);
 }
 assert.equal(ctx.getBatchAge('2026-11-10',new Date(2026,10,13)).days,3);
 assert.equal(ctx.getBatchAge('2026-10-31',new Date(2026,10,2)).days,2);
});
test('portal normalizers and admin day saves retain priority',()=>{
 for(const file of ['public/app.js','public/admin.js']){
  const source=fs.readFileSync(file,'utf8'),a=source.indexOf('function normalizeBatchList('),b=source.indexOf('\nfunction ',a+1),ctx={batchChecklistItems:[]};
  vm.createContext(ctx);vm.runInContext(source.slice(a,b),ctx);
  assert.equal(ctx.normalizeBatchList([{item:'A',priority:3}])[0].priority,3);
  assert.equal(ctx.normalizeBatchList([{item:'A'}])[0].priority,2);
 }
 const source=fs.readFileSync('public/admin.js','utf8'),row={dataset:{priority:'1'},querySelector:()=>({value:'A'}),querySelectorAll:()=>[]};
 const ctx={getBatchRows:()=>({querySelectorAll:()=>[row]})};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function getBatchValues('),source.indexOf('function syncGeneratedBatchTasksFromBatches(')),ctx);
 assert.equal(ctx.getBatchValues('hijnx')[0].priority,1);
});
test('priority change saves correct revision and reverts when saving fails',async()=>{
 function node(){return {classList:{add(){}},children:[],handlers:{},append(...values){this.children.push(...values)},appendChild(value){this.children.push(value)},setAttribute(){},addEventListener(name,fn){this.handlers[name]=fn},add(option){this.children.push(option)}}}
 let body,fail=false;const batch={label:'Hijnx',item:'A',scheduleDate:'2026-11-10',batchType:'hijnx',batchIndex:0,priority:2,revision:'old'};
 const ctx={document:{createElement:node,querySelectorAll:()=>[]},Option:function(label,value){this.value=value},dailyMetrcSavePending:false,
  applyDailyBatchMetadata:saved=>{batch.priority=1;batch.revision=saved.revision},
  fetch:async(url,options)=>{body=JSON.parse(options.body);return fail?{ok:false,text:async()=> 'Day changed'}:{ok:true,json:async()=>({revision:'new'})}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/batch-priority.js','utf8'),ctx);
 const card=node();ctx.appendBatchPriority(card,batch);const header=card.children[0],select=header.children[0].children[0];
 select.value='1';await select.handlers.change();assert.equal(body.priority,1);assert.equal(body.base_revision,'old');
 fail=true;select.value='3';await select.handlers.change();assert.equal(select.value,'1');assert.match(header.children[2].textContent,/Day changed/);
});
