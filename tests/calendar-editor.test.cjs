const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/admin-calendar-editor.js','utf8');
const code=source.slice(source.indexOf('async function saveScheduleDay() {'),source.length);
async function scenario(failure=false){
 const button={disabled:false,textContent:'Save Day'},input={disabled:false},previouslyDisabled={disabled:true};
 const editor={querySelectorAll:()=>[button,input,previouslyDisabled],setAttribute(){this.busy=true},removeAttribute(){this.busy=false}};
 let resolve,requests=0,closed=false,renders=0,status='',message='';
 const pending=new Promise(r=>resolve=r);
 const ctx={scheduleDaySavePending:false,scheduleEditorBaseRevision:'base-version',adminCalendarLoadSequence:0,adminScheduleRevisions:new Map(),document:{getElementById:id=>({schedule_edit_date:{value:'2026-09-21'},scheduleEditor:editor,scheduleSaveButton:button,scheduleReloadButton:{hidden:true}}[id])},
 buildSchedulePayload:()=>'{"events":[]}',isWeekendIsoDate:()=>false,
 setScheduleSaveStatus:t=>status=t,adminFetch:(url,options)=>{assert.equal(JSON.parse(options.body).base_revision,'base-version');requests++;return pending},adminScheduleRows:new Map(),
 cancelScheduleEdit:()=>closed=true,showMessage:t=>message=t,dateOnly:d=>d,adminCalendarStartDate:new Date('2026-09-21'),
 addDays:d=>d,buildAdminActiveScheduleByDate:rows=>rows,renderAdminCalendar:()=>renders++,console};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const first=ctx.saveScheduleDay();await ctx.saveScheduleDay();
 assert.equal(requests,1);assert.equal(button.textContent,'Saving…');assert.equal(input.disabled,true);assert.equal(editor.busy,true);assert.match(status,/Saving/);
 resolve(failure === 'network' ? Promise.reject(new Error('Server unavailable')) : failure?{ok:false,status:failure === 'conflict' ? 409 : 500,text:async()=> 'Server unavailable'}:{ok:true,json:async()=>({tasks:'{"events":[{"id":"server-id"}]}'})});await first;
 assert.equal(button.textContent,'Save Day');assert.equal(input.disabled,false);assert.equal(previouslyDisabled.disabled,true);assert.equal(editor.busy,false);
 if(failure){assert.equal(closed,false);assert.match(status,/Server unavailable/);assert.equal(renders,0)}
 else{assert.equal(closed,true);assert.equal(renders,1);assert.match(ctx.adminScheduleRows.get('2026-09-21'),/server-id/);assert.equal(message,'Calendar day updated.');}
}
(async()=>{await scenario();await scenario(true);await scenario('conflict');await scenario('network');console.log('PASS: single submission while pending, immediate busy feedback, control restoration, authoritative event IDs, no reload request, failure keeps editor open.');})().catch(e=>{console.error(e);process.exitCode=1});
