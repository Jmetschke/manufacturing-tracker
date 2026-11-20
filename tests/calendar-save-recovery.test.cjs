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
