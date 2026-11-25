const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {updateBatchMetrc}=require('../server/batch-metrc');
const {completeBatch}=require('../server/complete-batch');
const moveBatch=require('../server/move-calendar-batch');
test('Metrc text is per batch, supports corrections and clearing, and survives completion and moving',()=>{
 const payload={batchHijnx:[{item:'A',units:100},{item:'A'}],batchSb:[{item:'A'}],tasks:[],processingTasks:[]};
 const input={batchType:'hijnx',batchIndex:0,item:'A',metrc_number:' 000ABC123456789012345678 '};
 updateBatchMetrc(payload,input);
 assert.equal(payload.batchHijnx[0].metrc_number,'000ABC123456789012345678');
 assert.equal(payload.batchHijnx[1].metrc_number,undefined);assert.equal(payload.batchSb[0].metrc_number,undefined);
 completeBatch(payload,{...input,completedDate:'2026-11-25'});
 const target={};moveBatch(payload,target,{...input,sourceDate:'2026-11-25',targetDate:'2026-11-26'});
 assert.equal(target.batchHijnx[0].metrc_number,'000ABC123456789012345678');
 updateBatchMetrc(target,{...input,metrc_number:'00123'});assert.equal(target.batchHijnx[0].metrc_number,'00123');
 updateBatchMetrc(target,{...input,metrc_number:''});assert.equal(target.batchHijnx[0].metrc_number,'');
 assert.throws(()=>updateBatchMetrc(target,{...input,item:'Moved'}),{status:409});
 for(const metrc_number of [12,null,'x'.repeat(101)])assert.throws(()=>updateBatchMetrc(target,{...input,metrc_number}),{status:400});
});
test('both portal parsers and the admin calendar save retain Metrc numbers',()=>{
 for(const file of ['public/app.js','public/admin.js']){
  const source=fs.readFileSync(file,'utf8'),start=source.indexOf('function normalizeBatchList('),end=source.indexOf('\nfunction ',start+1);
  const ctx={batchChecklistItems:[]};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
  assert.equal(ctx.normalizeBatchList([{item:'A',metrc_number:'000ABC'}])[0].metrc_number,'000ABC');
 }
 const source=fs.readFileSync('public/admin.js','utf8');
 const row={dataset:{metrcNumber:'000ABC'},querySelector:selector=>({value:selector==='.batch-input'?'A':'100'}),querySelectorAll:()=>[]};
 const ctx={getBatchRows:()=>({querySelectorAll:()=>[row]})};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function getBatchValues('),source.indexOf('function syncGeneratedBatchTasksFromBatches(')),ctx);
 assert.equal(ctx.getBatchValues('hijnx')[0].metrc_number,'000ABC');
});
test('Metrc form saves without opening card details and preserves input on failure',async()=>{
 function node(){return {style:{},value:'',children:[],handlers:{},append(...v){this.children.push(...v)},appendChild(v){this.children.push(v)},setAttribute(){},addEventListener(k,f){this.handlers[k]=f}}}
 const ctx={document:{createElement:node,querySelectorAll:()=>[]},dailyReportBatchRows:[{schedule_date:'2026-11-25'}]};let request,fail=false;
 ctx.fetch=async(url,options)=>{request=JSON.parse(options.body);return fail?{ok:false,text:async()=> 'Day changed'}:{ok:true,json:async()=>({schedule_date:'2026-11-25',revision:'new',tasks:JSON.stringify({batchHijnx:[{metrc_number:'000ABC'}]})})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/batch-metrc.js','utf8'),ctx);
 const card=node(),batch={scheduleDate:'2026-11-25',batchType:'hijnx',batchIndex:0,item:'A',revision:'old'};
 ctx.appendBatchMetrc(card,batch);const form=card.children[0],input=form.children[0].children[0],status=form.children[2];
 input.value='000ABC';let stopped=false;form.handlers.click({stopPropagation(){stopped=true}});assert.equal(stopped,true);
 await form.handlers.submit({preventDefault(){},stopPropagation(){}});
 assert.equal(request.metrc_number,'000ABC');assert.equal(batch.revision,'new');assert.equal(status.textContent,'Metrc # saved.');
 fail=true;input.value='new draft';await form.handlers.submit({preventDefault(){},stopPropagation(){}});
 assert.equal(input.value,'new draft');assert.match(status.textContent,/Day changed/);
});
