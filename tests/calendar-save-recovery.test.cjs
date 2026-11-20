const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/admin-calendar-editor.js','utf8');
const code=source.slice(source.indexOf('function calendarSaveContent('),source.indexOf('async function saveScheduleDay('));
test('lost-response verification recognizes assigned event IDs but rejects different saved edits',async()=>{
 const tasks=JSON.stringify({events:[{title:'A',date:'2026-11-20',days:1,location:'Office',company:'Hijnx',times:[]}],tasks:[]});
 let stored=JSON.stringify({tasks:[],events:[{...JSON.parse(tasks).events[0],id:'server-id',outlookEventId:'external'}]});
 let calls=0;
 const ctx={AbortSignal,adminFetch:async(url)=>{calls++;assert.equal(url,'/schedule?from=2026-11-20&to=2026-11-20');return {ok:true,json:async()=>[{schedule_date:'2026-11-20',tasks:stored,revision:'saved'}]}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 assert.equal((await ctx.verifyCalendarSave('2026-11-20',tasks)).revision,'saved');
 stored=stored.replace('Office','Other room');
 assert.equal(await ctx.verifyCalendarSave('2026-11-20',tasks),null);assert.equal(calls,2);
});
test('rate requests are shared and failures can be retried without unhandled rejection',async()=>{
 const app=fs.readFileSync('public/admin.js','utf8');
 let calls=0,fail=false;
 const ctx={URLSearchParams,adminFetch:async()=>{calls++;if(fail)throw Error('Load failed');return {ok:true,json:async()=>({units_per_hour:10})}}};
 vm.createContext(ctx);vm.runInContext(app.slice(app.indexOf('const scheduleRateRequests ='),app.indexOf('async function autoFillScheduleTaskHours(')),ctx);
 await Promise.all(Array.from({length:20},()=>ctx.loadScheduleTaskRate('A','Pack')));assert.equal(calls,1);
 fail=true;assert.equal(await ctx.loadScheduleTaskRate('B','Cook'),null);
 fail=false;assert.equal((await ctx.loadScheduleTaskRate('B','Cook')).units_per_hour,10);assert.equal(calls,3);
});
test('interrupted saves retry once with the same revision; lost replies never duplicate a confirmed save',async()=>{
 for(const mode of ['before-write','lost-reply','verification-offline','offline','conflict']){
  let puts=0,reads=0,stored=null;const bodies=[];
  const tasks=JSON.stringify({events:[],tasks:[]});
  const saved={schedule_date:'2026-11-20',tasks,revision:'saved'};
  const ctx={AbortSignal,setScheduleSaveStatus(){},adminFetch:async(url,options)=>{
   if(options.method==='PUT'){
    puts++;bodies.push(options.body);
    if(mode==='conflict'||(mode==='verification-offline'&&puts===2))return {ok:false,status:409,text:async()=> 'Day changed'};
    if(mode==='lost-reply'||mode==='verification-offline')stored=saved;
    if(mode==='offline'||puts===1)throw Error('Load failed');
    stored=saved;return {ok:true,json:async()=>saved};
   }
   reads++;
   if(mode==='offline'||(mode==='verification-offline'&&reads===1))throw Error('Load failed');
   return {ok:true,json:async()=>stored?[stored]:[]};
  }};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  if(mode==='offline'||mode==='conflict')await assert.rejects(ctx.submitCalendarDay('2026-11-20',tasks,'original'));
  else assert.equal((await ctx.submitCalendarDay('2026-11-20',tasks,'original')).revision,'saved');
  assert.equal(puts,mode==='lost-reply'||mode==='conflict'?1:2);
  assert.ok(bodies.every(body=>JSON.parse(body).base_revision==='original'));
  if(mode==='conflict')assert.equal(reads,0);
 }
});
test('version checks defer reload while calendar editing, including an editor opened during cache cleanup',async()=>{
 const script=fs.readFileSync('public/pwa-install.js','utf8');
 for(const openDuringCleanup of [false,true]){
  let editing=!openDuringCleanup,reloads=0,writes=0;
  const ctx={window:{},console,productionTrackerVersionCheckInFlight:false,productionTrackerLaunchSettled:true,
   productionTrackerBuildStorageKey:'build',productionTrackerReloadFlagKey:'reload',
   fetch:async()=>({ok:true,json:async()=>({build:'new'})}),
   document:{getElementById:()=>({classList:{contains:()=>editing}})},
   localStorage:{getItem:()=> 'old',setItem:()=>writes++},sessionStorage:{getItem:()=>null},
   clearProductionTrackerStaticCaches:async()=>{if(openDuringCleanup)editing=true},reloadProductionTrackerForBuild:()=>reloads++};
  vm.createContext(ctx);vm.runInContext(script.slice(script.indexOf('async function checkProductionTrackerBuildVersion()'),script.indexOf('function registerProductionTrackerBuildChecks()')),ctx);
  await ctx.checkProductionTrackerBuildVersion();assert.equal(reloads,0);assert.equal(writes,0);
  editing=false;ctx.clearProductionTrackerStaticCaches=async()=>{};
  await ctx.checkProductionTrackerBuildVersion();assert.equal(reloads,1);
 }
});
