const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function pricing(rules,requirements={},existing=null){
 const writes=[];const exports={};
 const lead={id:'lead',ventureId:'bubble',venture:{name:'Bubble Leisure'},requirements:{activity:'Bubble football',players:10,duration:60,...requirements}};
 const prisma={lead:{findUnique:async()=>lead,update:async q=>{writes.push(q);return lead}},pricingRule:{findMany:async()=>rules},quote:{findFirst:async()=>existing,create:async q=>{writes.push(q);return{id:'quote',...q.data}},update:async q=>{writes.push(q);return{id:'quote',...q.data}}}};
 const source=fs.readFileSync('lib/server/bubble-conversion.ts','utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports,require:()=>({prisma}),process:{env:{}},fetch:()=>{throw Error('Unexpected send')}});
 return{api:exports,writes};
}
const rule={id:'rule',activity:'Bubble football',durationMinutes:60,basePriceMin:250,basePriceMax:250,staffingCost:100,equipmentCost:20};
test('missing authoritative rules cannot generate a quote from a generic fallback',async()=>{const p=pricing([]);assert.equal((await p.api.calculateBubbleQuote('lead')).ok,false);assert.equal(p.writes.length,0)});
test('missing duration and wrong customer type require review',async()=>{for(const [r,req] of [[rule,{duration:null}],[{...rule,customerType:'kids'},{occasion:'adult'}]]){const p=pricing([r],req);assert.equal((await p.api.calculateBubbleQuote('lead')).ok,false);assert.equal(p.writes.length,0)}});
test('deterministic matching rule produces price and actual margin',async()=>{const p=pricing([rule]);const q=await p.api.calculateBubbleQuote('lead');assert.equal(q.customerPrice,250);assert.equal(p.writes[0].data.grossProfit,130)});
test('conflicting rule prices require review',async()=>{const p=pricing([rule,{...rule,id:'other',basePriceMin:300,basePriceMax:300}]);assert.equal((await p.api.calculateBubbleQuote('lead')).ok,false);assert.equal(p.writes.length,0)});
test('an unsent quote is refreshed while a changed sent quote requires review',async()=>{const p=pricing([rule],{},{id:'quote',status:'Ready',customerPrice:300});assert.equal((await p.api.calculateBubbleQuote('lead')).customerPrice,250);assert.equal(p.writes[0].data.customerPrice,250);const sent=pricing([rule],{},{id:'quote',status:'Sent',customerPrice:300});assert.equal((await sent.api.calculateBubbleQuote('lead')).reason,'sent-quote-requires-review');assert.equal(sent.writes.length,0)});
