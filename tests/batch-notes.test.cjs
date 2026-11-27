const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {updateBatchNotes}=require('../server/batch-notes');
const {completeBatch}=require('../server/complete-batch');
const moveBatch=require('../server/move-calendar-batch');
test('notes have server IDs and dates, stay isolated, survive moving/completion, and delete individually',()=>{
 const payload={batchHijnx:[{item:'A'},{item:'A'}],batchSb:[{item:'A'}],tasks:[],processingTasks:[]};
 const input={batchType:'hijnx',batchIndex:0,item:'A',action:'add',text:'  First\nline  ',posted_at:'1900-01-01',noteId:'fake'};
 updateBatchNotes(payload,input);updateBatchNotes(payload,{...input,text:'Second'});
 const notes=payload.batchHijnx[0].notes;
 assert.equal(notes.length,2);assert.equal(notes[0].text,'First\nline');assert.notEqual(notes[0].id,notes[1].id);assert.notEqual(notes[0].id,'fake');
 assert.ok(Math.abs(Date.now()-Date.parse(notes[0].posted_at))<5000);
 assert.equal(payload.batchHijnx[1].notes,undefined);assert.equal(payload.batchSb[0].notes,undefined);
 completeBatch(payload,{...input,completedDate:'2026-11-27'});
 const target={};moveBatch(payload,target,{...input,sourceDate:'2026-11-27',targetDate:'2026-11-30'});
 assert.deepEqual(target.batchHijnx[0].notes,notes);
 updateBatchNotes(target,{...input,action:'delete',noteId:notes[0].id});
 assert.equal(target.batchHijnx[0].notes.length,1);assert.equal(target.batchHijnx[0].notes[0].id,notes[1].id);
 assert.throws(()=>updateBatchNotes(target,{...input,action:'delete',noteId:'missing'}),{status:409});
 for(const text of ['', '  ', 'x'.repeat(2001), null])assert.throws(()=>updateBatchNotes(target,{...input,text}),{status:400});
 assert.throws(()=>updateBatchNotes(target,{...input,item:'wrong'}),{status:409});
});
test('notes survive both portal parsers and an admin calendar save',()=>{
 const notes=[{id:'1',text:'Keep me',posted_at:'2026-11-27T12:00:00Z'}];
 for(const file of ['public/app.js','public/admin.js']){
  const source=fs.readFileSync(file,'utf8'),start=source.indexOf('function normalizeBatchList('),end=source.indexOf('\nfunction ',start+1),ctx={batchChecklistItems:[]};
  vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
  assert.equal(ctx.normalizeBatchList([{item:'A',notes}])[0].notes,notes);
 }
 const source=fs.readFileSync('public/admin.js','utf8');
 const row={dataset:{batchNotes:JSON.stringify(notes)},querySelector:()=>({value:'A'}),querySelectorAll:()=>[]};
 const ctx={getBatchRows:()=>({querySelectorAll:()=>[row]})};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function getBatchValues('),source.indexOf('function syncGeneratedBatchTasksFromBatches(')),ctx);
 assert.equal(JSON.stringify(ctx.getBatchValues('hijnx')[0].notes),JSON.stringify(notes));
});
test('notes UI displays saved text/date, deletes only selected note, and retains failed draft',async()=>{
 function node(){return {children:[],handlers:{},value:'',append(...v){this.children.push(...v)},appendChild(v){this.children.push(v)},replaceChildren(){this.children=[]},setAttribute(){},addEventListener(k,f){this.handlers[k]=f}}}
 const batch={item:'A',scheduleDate:'2026-11-27',batchType:'hijnx',batchIndex:0,revision:'base',notes:[]};let fail=false,body;
 const ctx={document:{createElement:node,querySelectorAll:()=>[]},dailyMetrcSavePending:false,applyDailyBatchMetadata:saved=>{batch.notes=saved.notes;batch.revision='new'},fetch:async(url,options)=>{
  body=JSON.parse(options.body);return fail?{ok:false,text:async()=> 'Conflict'}:{ok:true,json:async()=>({notes:body.action==='add'?[{id:'n1',text:body.text,posted_at:'2026-11-27T12:00:00Z'}]:[]})};
 }};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/batch-notes.js','utf8'),ctx);
 const card=node();ctx.appendBatchNotes(card,batch);
 const section=card.children[0],list=section.children[1],form=section.children[2],input=form.children[0].children[0],status=section.children[3];
 input.value='<b>literal</b>\nNote';await form.handlers.submit({preventDefault(){},stopPropagation(){}});
 assert.equal(input.value,'');assert.equal(list.children[0].children[1].textContent,'<b>literal</b>\nNote');assert.match(list.children[0].children[0].textContent,/2026/);
 await list.children[0].children[2].handlers.click();assert.equal(body.noteId,'n1');assert.equal(list.textContent,'No notes yet.');
 fail=true;input.value='Keep draft';await form.handlers.submit({preventDefault(){},stopPropagation(){}});assert.equal(input.value,'Keep draft');assert.match(status.textContent,/Conflict/);
});
