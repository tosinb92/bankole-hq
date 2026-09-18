import { AiStatus, PricingRule, Stage, VenueStatus } from "./types";

export const ventures = [
  ["Bubble Leisure", "Events", "Active", "12 open leads"], ["Bankole & Associates", "Advisory", "Active", "3 live mandates"], ["Brilliant AI Automation", "AI automation", "Active", "3 opportunities"], ["TradeCompare", "SaaS", "Build", "Data strategy"], ["FireComplianceUK", "Marketplace", "Active", "5 inspectors"], ["Lucky Studios", "AI studio", "Build", "SAYAH launch"], ["SAYAH", "Music IP", "Active", "Release prep"], ["Oddly", "Creative studio", "Build", "Visual concepts"]
];
export const pricingRules: PricingRule[] = [
  { id:"kids-60", name:"Kids core 60", activity:"Bubble Football", customerType:"Kids", duration:60, min:250, max:250, staffing:85, equipment:35, minMargin:45, active:true },
  { id:"kids-90", name:"Kids core 90", activity:"Nerf Gun Wars", customerType:"Kids", duration:90, min:300, max:300, staffing:110, equipment:50, minMargin:45, active:true },
  { id:"combo-90", name:"Kids combo 90", activity:"Combo", customerType:"Kids", duration:90, min:350, max:450, staffing:125, equipment:75, minMargin:45, active:true },
  { id:"adult-90", name:"Adult 90", activity:"Bubble Football", customerType:"Adult", duration:90, min:370, max:450, staffing:130, equipment:65, minMargin:45, active:true },
  { id:"adult-120", name:"Adult 120", activity:"Bubble Football", customerType:"Adult", duration:120, min:450, max:600, staffing:170, equipment:85, minMargin:45, active:true },
  { id:"school", name:"School programme", activity:"Dodgeball", customerType:"School", duration:120, min:500, max:700, staffing:180, equipment:100, minMargin:45, active:true },
  { id:"archery", name:"Archery add-on", activity:"Archery", customerType:"Any", duration:60, min:120, max:180, staffing:75, equipment:35, minMargin:45, active:true },
  { id:"axe", name:"Axe throwing add-on", activity:"Axe Throwing", customerType:"Adult", duration:60, min:150, max:220, staffing:90, equipment:45, minMargin:45, active:true }
];
export const leads: {name:string; event:string; location:string; stage:Stage; value:number; next:string; flag?:string}[] = [
  {name:"Amelia Carter",event:"30 kids · Nerf + Bubble · 90 min",location:"Colchester CO1",stage:"Venue sourcing",value:425,next:"Venue response due 10:30",flag:"Blocked"},
  {name:"Northgate Primary",event:"School activity day · 120 min",location:"Ipswich IP4",stage:"Pricing",value:650,next:"Quote needs approval",flag:"Hot"},
  {name:"Jake Wilson",event:"Adult bubble football · 90 min",location:"Chelmsford CM1",stage:"Call",value:410,next:"Call back today",flag:"Call"},
  {name:"Maya Patel",event:"20 kids · Nerf · 60 min",location:"Bury St Edmunds",stage:"Follow-up",value:250,next:"Quote sent 2 days ago",flag:"Overdue"}
];
export const venues: {name:string; postcode:string; activities:string; capacity:string; price:number; unit:string; status:VenueStatus; availability:string; verified:string; contact:string; method:string}[] = [
  {name:"Colchester Sports Centre",postcode:"CO4 5YX",activities:"Bubble, Nerf, Dodgeball",capacity:"40",price:82,unit:"per hour",status:"Verified",availability:"Enquiry sent",verified:"12 Sep 2026",contact:"events@colchestersc.co.uk",method:"Email"},
  {name:"St Mark's Community Hall",postcode:"CO1 2QW",activities:"Nerf, Archery",capacity:"50",price:65,unit:"per session",status:"Historical",availability:"Check required",verified:"14 Aug 2026",contact:"01206 555 002",method:"Phone"},
  {name:"Lakeside Pavilion",postcode:"CO2 8WZ",activities:"Bubble, Dodgeball",capacity:"30",price:95,unit:"per booking",status:"Estimated",availability:"Unknown",verified:"—",contact:"—",method:"Website form"}
];
export const aiJobs: {title:string; venture:string; skill:string; status:AiStatus; updated:string; input?:string; output?:string; source?:string}[] = [
  {title:"Repurpose safe internal operating insight",venture:"Lucky Studios",skill:"content-repurposing",status:"Needs Approval",updated:"Just now",source:"content-repurposing.zip · SKILL.md",input:"Original safe demo: ‘An action-first operating system turns a vague priority into an assigned next step, evidence and an approval state.’",output:"LinkedIn draft: Dashboards show you work. An operating system tells you what moves next. Every priority needs an owner, evidence, a next step and a decision state. That is how work stops being visible and starts becoming executable.\n\nShort-form script: If your dashboard cannot tell you who acts next, it is decoration. Turn every priority into an owner, proof, a next step and an approval state."},
  {title:"Extract party requirements",venture:"Bubble Leisure",skill:"Requirements Extractor",status:"Completed",updated:"8 min ago"},
  {title:"Rank Colchester venues",venture:"Bubble Leisure",skill:"Venue Agent",status:"Needs Approval",updated:"12 min ago"},
  {title:"Draft school quote",venture:"Bubble Leisure",skill:"Quote Composer",status:"Queued",updated:"Now"},
  {title:"SAYAH release research",venture:"Lucky Studios",skill:"Instagram Research Capture",status:"Blocked",updated:"Today"}
];
export const skills = ["Niche Hacking","Content Repurposing","YappMaxxing Scriptwriter","YappMaxxing Longform","Hook-Proof-Value-CTA","Belief Breaking Diamond","Non-Obvious Tactical","Kallaway Rewrite","YouTube Packaging","Carousel Creation","Presentation Creation","Instagram Research Capture"];
