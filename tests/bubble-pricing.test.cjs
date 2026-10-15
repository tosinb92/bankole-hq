const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function pricing(requirements={},existing=null){
 const writes=[];const exports={};
 const lead={id:'lead',ventureId:'bubble',venture:{name:'Bubble Leisure'},requirements:{activity:'Bubble football',players:10,duration:60,...requirements}};
 const prisma={lead:{findUnique:async()=>lead,update:async q=>{writes.push(q);return lead}},quote:{findFirst:async()=>existing,create:async q=>{writes.push(q);return{id:'quote',...q.data}},update:async q=>{writes.push(q);return{id:'quote',...q.data}}}};
 const source=fs.readFileSync('lib/server/bubble-conversion.ts','utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports,require:()=>({prisma}),process:{env:{}},fetch:()=>{throw Error('Unexpected send')}});
 return{api:exports,writes};
}
const confirmed={venueFee:0,travelFee:0,addOnFee:0,confirmedDirectCosts:120};
test('unconfirmed charges cannot produce a sendable quote',async()=>{const p=pricing();const result=await p.api.calculateBubbleQuote('lead');assert.equal(result.ok,false);assert.equal(result.reason,'charges-require-confirmation');assert.equal(p.writes.some(x=>x.data.status==='Ready'),false)});
test('missing duration and unsupported packages require review',async()=>{for(const req of [{duration:null},{package:'Premium bubble football'}]){const p=pricing(req);assert.equal((await p.api.calculateBubbleQuote('lead')).ok,false);assert.equal(p.writes.length,0)}});
test('saved owner calculator produces selling price and actual margin',async()=>{const p=pricing(confirmed);const q=await p.api.calculateBubbleQuote('lead');assert.equal(q.customerPrice,250);assert.equal(p.writes.find(x=>x.data.status==='Ready').data.grossProfit,130)});
test('unknown delivery costs cannot create fictitious profit',async()=>{const p=pricing({...confirmed,confirmedDirectCosts:undefined});assert.equal((await p.api.calculateBubbleQuote('lead')).reason,'delivery-costs-require-confirmation');assert.equal(p.writes.some(x=>x.data.status==='Ready'),false)});
test('unsent quotes refresh; changed sent quotes require review',async()=>{const p=pricing(confirmed,{id:'quote',status:'Ready',customerPrice:300});assert.equal((await p.api.calculateBubbleQuote('lead')).customerPrice,250);assert.equal(p.writes.find(x=>x.data.status==='Ready').data.customerPrice,250);const sent=pricing(confirmed,{id:'quote',status:'Sent',customerPrice:300});assert.equal((await sent.api.calculateBubbleQuote('lead')).reason,'sent-quote-requires-review');assert.equal(sent.writes.some(x=>x.data.status==='Ready'),false)});
