const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function harness() {
  const leads = [], events = [];
  const tx = {
    $executeRaw: async () => 1,
    lead: {
      findFirst: async ({where}) => leads.find(l => l.requirements.websiteEnquiryId === where.requirements.equals) || null,
      create: async ({data}) => { const lead = {id: 'lead-' + (leads.length + 1), ...data}; leads.push(lead); return lead; }
    }
  };
  const prisma = {
    venture: {findUnique: async () => ({id:'bubble'})},
    $transaction: async fn => fn(tx),
    $queryRaw: async (_strings, source, sourceRef) => events.filter(e => e.source === source && e.sourceRef === sourceRef)
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/api/hq/webhook/route.ts'),'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const sandbox = {exports:{}, process:{env:{HQ_WEBHOOK_SECRET:'test-secret', BUBBLE_HQ_WEBHOOK_SECRET:'bubble-secret'}}, require(name) {
    if (name === 'next/server') return {NextResponse:{json:(body,options={})=>({body,status:options.status||200})}};
    if (name === 'crypto') return require('node:crypto');
    if (name.endsWith('/prisma')) return {prisma};
    if (name.endsWith('/hq-live')) return {recordHqEvent:async e=>events.push(e),markSync:async()=>{}};
    throw new Error('Unexpected import '+name);
  }};
  vm.runInNewContext(code,sandbox);
  const request=(body,secret='test-secret')=>({headers:{get:()=>secret},json:async()=>body});
  return {post:sandbox.exports.POST,request,leads,events,prisma};
}
const enquiry={id:'test-enquiry-1',source:'bubble-leisure-website',type:'LEAD_CREATED',payload:{name:'SIMULATION Customer',email:'customer@example.invalid',occasion:'Birthday',activity:'Bubble Football',location:'Ipswich',guests:'12'}};

test('website secret accepts Bubble enquiries and rejects other event sources',async()=>{const h=harness();assert.equal((await h.post(h.request(enquiry,'bubble-secret'))).status,200);assert.equal((await h.post(h.request({source:'another-system',type:'UPDATE'},'bubble-secret'))).status,403);assert.equal(h.leads.length,1);assert.equal(h.events.length,1);});

test('rejects unauthorised enquiries without writing records',async()=>{const h=harness();assert.equal((await h.post(h.request(enquiry,'wrong'))).status,401);assert.equal(h.leads.length,0);});
test('valid enquiry creates a usable lead and a linked activity',async()=>{const h=harness();const r=await h.post(h.request(enquiry));assert.equal(r.status,200);assert.equal(r.body.leadId,'lead-1');assert.equal(h.leads[0].requirements.players,'12');assert.equal(h.leads[0].requestedLocation,'Ipswich');assert.equal(h.events[0].payload.leadId,'lead-1');});
test('retry returns the same lead without duplicating lead or activity',async()=>{const h=harness();await h.post(h.request(enquiry));const r=await h.post(h.request(enquiry));assert.equal(r.body.leadId,'lead-1');assert.equal(h.leads.length,1);assert.equal(h.events.length,1);});
test('missing enquiry fields fail before any write',async()=>{const h=harness();assert.equal((await h.post(h.request({...enquiry,payload:{name:'test'}}))).status,400);assert.equal(h.leads.length,0);});
test('unconfigured venture does not acknowledge a lost enquiry',async()=>{const h=harness();h.prisma.venture.findUnique=async()=>null;assert.equal((await h.post(h.request(enquiry))).status,503);assert.equal(h.leads.length,0);});
test('other venture events retain the existing activity-only behavior',async()=>{const h=harness();assert.equal((await h.post(h.request({source:'another-system',type:'UPDATE',title:'Updated'}))).status,200);assert.equal(h.leads.length,0);assert.equal(h.events.length,1);});
