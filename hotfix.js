const fs=require('fs');

// 1) Make server validation match the actual UX: only the two status fields are strictly required.
// Optional sections can be left blank; conditional fields are validated only when selected.
fs.writeFileSync('src/lib/validation.ts', String.raw`import { z } from "zod";
import { ASSISTANCE_REQUIRED, FINANCIAL_COMFORT, MAJOR_CHANGES, OVERALL_FAMILY_STATUS, PREFERRED_COMMUNICATION, PREFERRED_CONTACT_TIMING, PREFERRED_TIME, YES_NO } from "./field-mapping";
import { normalizeIndianMobile } from "./mobile-normalizer";

export const loginSchema=z.object({
  email:z.string().trim().toLowerCase().min(1,"Email is required").email("Enter a valid email address"),
  mobile:z.string().trim().min(1,"Mobile number is required").transform((v,c)=>{const n=normalizeIndianMobile(v);if(!n){c.addIssue({code:z.ZodIssueCode.custom,message:"Enter a valid Indian mobile number"});return z.NEVER}return n})
});
export type LoginInput=z.infer<typeof loginSchema>;
export const checkinStatusSchema=z.object({year:z.number().int().min(2020).max(2100),month:z.number().int().min(1).max(12)});
export type CheckinStatusInput=z.infer<typeof checkinStatusSchema>;

const optEnum=(vals:readonly [string,...string[]])=>z.preprocess(v=>v===""||v===null?undefined:v,z.enum(vals as any).optional());
const optRating=z.preprocess(v=>v===""||v===null||v===undefined?undefined:Number(v),z.number().int().min(1).max(5).optional());
const referral=z.object({
  name:z.string().trim().min(1,"Referral name is required"),
  mobile:z.string().trim().transform((v,c)=>{const n=normalizeIndianMobile(v);if(!n){c.addIssue({code:z.ZodIssueCode.custom,message:"Enter a valid Indian mobile number"});return z.NEVER}return n})
});

export const checkinFormSchema=z.object({
  overallFamilyStatus:z.enum(OVERALL_FAMILY_STATUS),
  financialComfort:z.enum(FINANCIAL_COMFORT),
  majorChanges:z.array(z.enum(MAJOR_CHANGES)).optional().default([]),
  otherMajorChange:z.string().trim().max(500).optional().default(""),
  assistanceRequired:z.array(z.enum(ASSISTANCE_REQUIRED)).optional().default([]),
  otherAssistance:z.string().trim().max(500).optional().default(""),
  serviceRating:optRating,
  teamResponsivenessRating:optRating,
  adviceReceived:optEnum(YES_NO as any),
  wantTeamContact:optEnum(YES_NO as any),
  preferredContactTiming:optEnum(PREFERRED_CONTACT_TIMING as any),
  preferredCommunication:optEnum(PREFERRED_COMMUNICATION as any),
  preferredTime:optEnum(PREFERRED_TIME as any),
  suggestions:z.string().trim().max(2000).optional().default(""),
  recommendHappyCoin:optEnum(YES_NO as any),
  referrals:z.array(referral).optional().default([])
}).superRefine((d,c)=>{
  if(d.majorChanges.includes("Other")&&!d.otherMajorChange)c.addIssue({code:z.ZodIssueCode.custom,path:["otherMajorChange"],message:"Please describe the other change"});
  if(d.assistanceRequired.includes("Other")&&!d.otherAssistance)c.addIssue({code:z.ZodIssueCode.custom,path:["otherAssistance"],message:"Please describe the assistance needed"});
  if(d.wantTeamContact==="Yes"){
    if(!d.preferredContactTiming)c.addIssue({code:z.ZodIssueCode.custom,path:["preferredContactTiming"],message:"Select a contact timing"});
    if(!d.preferredCommunication)c.addIssue({code:z.ZodIssueCode.custom,path:["preferredCommunication"],message:"Select a communication method"});
    if(!d.preferredTime)c.addIssue({code:z.ZodIssueCode.custom,path:["preferredTime"],message:"Select a preferred time"});
  }
});
export type CheckinFormValidatedInput=z.infer<typeof checkinFormSchema>;
`);

// 2) Allow partial optional sections to flow into the payload builder; undefined values are omitted by JSON.stringify.
let route=fs.readFileSync('src/app/api/checkin/submit/route.ts','utf8');
route=route.replace('buildCheckinRecordPayload(p.data,','buildCheckinRecordPayload(p.data as any,');
route=route.replace('error:"Please check the form for errors."','error:"Please complete the required fields.",validationIssues:p.error.issues.map(i=>({field:i.path.join("."),message:i.message}))');
route=route.replace('error:"Please complete the highlighted required fields."','error:"Please complete the required fields.",validationIssues:p.error.issues.map(i=>({field:i.path.join("."),message:i.message}))');
fs.writeFileSync('src/app/api/checkin/submit/route.ts',route);

// 3) Improve client-side error rendering so a generic message never hides the actual field.
let comp=fs.readFileSync('src/components/CheckinForm.tsx','utf8');
comp=comp.replace(/setError\(j\.error\|\|"Please complete the highlighted required fields\."\)/g,'setError((j.validationIssues?.length ? j.validationIssues.map((x:any)=>x.message).join(" • ") : j.error) || "Please complete the required fields.")');
comp=comp.replace(/setError\(j\.error\|\|"Please check the form for errors\."\)/g,'setError((j.validationIssues?.length ? j.validationIssues.map((x:any)=>x.message).join(" • ") : j.error) || "Please complete the required fields.")');
fs.writeFileSync('src/components/CheckinForm.tsx',comp);

// 4) Rebuild dashboard to match the approved premium application layout.
fs.writeFileSync('src/app/dashboard/page.tsx', String.raw`"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
type C=Record<string,any>;
const text=(v:any)=>v===null||v===undefined||v===""?"Not updated":String(v);
const money=(v:any)=>{if(v===null||v===undefined||v==="")return "Not updated";const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n):String(v)};
function Nav({active,label,icon,onClick,disabled=false}:{active?:boolean,label:string,icon:string,onClick?:()=>void,disabled?:boolean}){return <button disabled={disabled} onClick={onClick} className={\`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition \${active?"bg-teal-50 text-teal-800 ring-1 ring-teal-100":"text-slate-600 hover:bg-slate-50"} \${disabled?"cursor-default opacity-45":""}\`}><span className="text-lg">{icon}</span><span>{label}</span>{disabled&&<span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">Soon</span>}</button>}
function Stat({title,children,icon}:{title:string,children:React.ReactNode,icon:string}){return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.045)]"><div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-lg text-teal-700">{icon}</div><h3 className="font-bold text-slate-900">{title}</h3></div>{children}</section>}
function Row({l,v}:{l:string,v:string}){return <div className="flex items-start justify-between gap-4 border-t border-slate-100 py-3 first:border-0 first:pt-0"><span className="text-sm text-slate-500">{l}</span><span className="max-w-[55%] break-words text-right text-sm font-semibold text-slate-900">{v}</span></div>}
export default function Dashboard(){const r=useRouter(),[c,setC]=useState<C|null>(null),[status,setStatus]=useState<any>(null);useEffect(()=>{Promise.all([fetch('/api/customer',{cache:'no-store'}),fetch('/api/checkin/status',{cache:'no-store'})]).then(async([a,b])=>{if(a.status===401){r.replace('/');return}setC((await a.json()).customer??await a.clone().json().catch(()=>null));setStatus(await b.json().catch(()=>null))}).catch(()=>{})},[r]);if(!c)return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Loading HappyCoin…</div>;const name=[c.firstName,c.lastName].filter(Boolean).join(' ')||c.fullName||'HappyCoin Client';const rm=c.relationshipManager||c.owner||c.Owner||{};const next=status?.nextAvailable;return <div className="min-h-screen bg-[#f7f9fc] text-slate-900"><aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col"><div className="mb-8 flex items-center gap-3"><img src="/happycoin-logo.svg" className="h-11 w-11" alt="HappyCoin"/><div><div className="text-lg font-bold text-slate-900">HappyCoin</div><div className="text-xs text-slate-500">Client Care Check-in</div></div></div><nav className="space-y-2"><Nav active label="Dashboard" icon="▦"/><Nav label="Client Check-in" icon="▣" onClick={()=>r.push('/checkin')}/><Nav label="My Profile" icon="○" disabled/><Nav label="Resources" icon="□" disabled/><Nav label="Help & Support" icon="?" disabled/></nav><div className="mt-auto rounded-2xl bg-teal-50 p-4"><div className="text-sm font-bold text-slate-900">Need Help?</div><div className="mt-1 text-xs leading-5 text-slate-600">Talk to your Relationship Manager anytime.</div><div className="mt-3 text-xs font-semibold text-teal-800">{text(rm.name||rm.Name||c.ownerName)}</div></div></aside><div className="lg:pl-64"><header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-8"><div className="flex items-center gap-3 lg:hidden"><img src="/happycoin-logo.svg" className="h-9 w-9" alt="HappyCoin"/><span className="font-bold">HappyCoin</span></div><div className="hidden lg:block"><div className="text-sm text-slate-500">Welcome back</div><div className="font-semibold text-slate-900">{name}</div></div><button onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});r.replace('/')}} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Sign out</button></header><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="text-3xl font-bold tracking-tight text-slate-950">Your Financial Care Dashboard</h1><p className="mt-2 text-slate-500">Everything important about your protection, wealth plan and monthly client care.</p></div><div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200"><span className="text-slate-500">This month:</span> <span className="font-bold text-slate-900">{status?.monthName||new Intl.DateTimeFormat('en-IN',{month:'long'}).format(new Date())} {status?.year||new Date().getFullYear()}</span></div></div><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-6"><section className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#087f77] via-[#08a093] to-[#0b7976] p-7 text-white shadow-[0_18px_50px_rgba(8,127,119,.18)] sm:p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-white/70">HappyCoin Client Care</p><h2 className="mt-2 text-3xl font-bold">Welcome, {name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">Your financial protection, wealth plan and monthly care — all in one place.</p><button onClick={()=>r.push('/checkin')} className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-teal-800 shadow-lg">{status?.alreadySubmitted?'Review / Update Check-in':'Start Client Check-in'} →</button></section><div className="grid gap-5 md:grid-cols-2"><Stat title="Emergency Fund" icon="◈"><Row l="Emergency Fund" v={money(c.emergencyFund)}/></Stat><Stat title="Life Protection" icon="♥"><Row l="Term Insurance" v={text(c.termInsurance)}/><Row l="Insurance Cover" v={money(c.termInsuranceAmount)}/><Row l="Premium" v={money(c.termInsurancePremium)}/></Stat><Stat title="Health Protection" icon="✚"><Row l="Self Health Insurance" v={text(c.selfHealthInsurance)}/><Row l="Self Coverage" v={money(c.selfHealthCoverage)}/><Row l="Parents Insurance" v={text(c.parentsHealthInsurance)}/></Stat><Stat title="Wealth Creation" icon="↗"><Row l="Mutual Fund SIP Target" v={money(c.mfSipTarget)}/></Stat></div></div><aside className="space-y-5"><section className="rounded-2xl bg-gradient-to-br from-[#087f77] to-[#075d5d] p-6 text-white shadow-lg"><div className="text-xs font-bold uppercase tracking-wider text-white/65">Next Check-in</div><div className="mt-3 text-2xl font-bold">{next?`01 ${next.monthName} ${next.year}`:'Next month'}</div><div className="mt-1 text-sm text-white/70">10:00 AM IST</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="font-bold text-slate-900">Why this matters</div><p className="mt-2 text-sm leading-6 text-slate-600">Your regular check-in helps the HappyCoin team understand changes early and support you better.</p></section><section className="rounded-2xl border border-teal-100 bg-teal-50 p-5"><div className="font-bold text-slate-900">Need Assistance?</div><p className="mt-2 text-sm leading-6 text-slate-600">Your Relationship Manager is available whenever you need help.</p><div className="mt-3 text-sm font-semibold text-teal-800">{text(rm.name||rm.Name||c.ownerName)}</div><div className="mt-1 break-words text-xs text-slate-500">{text(rm.email||rm.Email||c.rmEmail)}</div></section></aside></div></main></div></div>}
`);

console.log('Applied HappyCoin hotfix: working validation + premium dashboard shell');
