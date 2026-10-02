const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(path,stubs={}) {
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)(name=>name in stubs?stubs[name]:require(name),module,module.exports);
 return module.exports;
}
test('booking access rejects forged, expired and wrong-purpose credentials',()=>{
 process.env.BUBBLE_SERVICE_SECRET='local-test-secret-never-use-in-production';
 const s=load('lib/server/bubble-security.ts');
 const token=s.bookingToken('customer-one');
 assert.equal(s.bookingLead(token),'customer-one');
 assert.equal(s.bookingLead(token.replace(token[0],token[0]==='a'?'b':'a')),null);
 assert.equal(s.bookingLead(process.env.BUBBLE_SERVICE_SECRET),null);
 assert.equal(s.bookingLead(`${token}.extra`),null);
 const old=Date.now;Date.now=()=>old()+61*86400000;
 try{assert.equal(s.bookingLead(token),null);}finally{Date.now=old;}
 assert.equal(s.bubbleService(new Request('https://example.test',{headers:{'x-hq-webhook-secret':'wrong'}})),false);
});
function paymentHarness(){
 const lead={id:'lead1',ventureId:'venture1',venture:{name:'Bubble Leisure'},requirements:{bookingApproval:{id:'approval1',quoteId:'quote1',payablePence:10000,eventAt:'2030-01-01T10:00:00Z'},checkout:{id:'cs_test_1'}}};
 let updates=0,bookings=0,messages=0;
 const tx={$queryRaw:async()=>[],lead:{findUnique:async()=>lead,update:async({data})=>{updates++;lead.requirements=data.requirements;}},quote:{update:async()=>{}},booking:{upsert:async()=>{bookings++;}}};
 const prisma={$transaction:async(fn)=>fn(tx)};
 const api=load('lib/server/bubble-payments.ts',{'./prisma':{prisma},'./bubble-security':{bubbleWebsiteUrl:()=>"https://bubble-leisure.vercel.app"},'./bubble-workflow':{queueBubbleMessage:async()=>{messages++;}}});
 const session={id:'cs_test_1',payment_status:'paid',currency:'gbp',amount_total:10000,metadata:{bubbleLeadId:'lead1',approvalId:'approval1',quoteId:'quote1'}};
 return {api,session,lead,counts:()=>({updates,bookings,messages})};
}
test('payment retries do not create a second booking',async()=>{
 const h=paymentHarness();await h.api.reconcileBubblePayment(h.session);await h.api.reconcileBubblePayment(h.session);
 assert.equal(h.counts().updates,1);assert.equal(h.counts().bookings,1);assert.equal(h.lead.requirements.payment.paidPence,10000);
});
test('wrong amount or approval cannot confirm a booking',async()=>{
 for(const change of [{amount_total:1},{metadata:{bubbleLeadId:'lead1',approvalId:'forged',quoteId:'quote1'}},{id:'unknown-session'}]){
  const h=paymentHarness();await assert.rejects(h.api.reconcileBubblePayment({...h.session,...change}));assert.equal(h.counts().bookings,0);
 }
});
test('unpaid and foreign currency events cannot confirm a booking',async()=>{
 for(const change of [{payment_status:'unpaid'},{currency:'usd'}]){const h=paymentHarness();await h.api.reconcileBubblePayment({...h.session,...change});assert.equal(h.counts().bookings,0);}
});
test('checkout cannot start while payment webhook is unconfigured',async()=>{
 delete process.env.STRIPE_WEBHOOK_SECRET;
 const h=paymentHarness();await assert.rejects(h.api.bubbleCheckout('lead1'),/reconciliation is not configured/);
});
