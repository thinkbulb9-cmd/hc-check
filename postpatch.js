const fs = require('fs');

const zohoFile = 'src/lib/zoho.ts';
if (!fs.existsSync(zohoFile)) throw new Error('zoho.ts missing after bootstrap');
let source = fs.readFileSync(zohoFile, 'utf8');
source = source.replaceAll('encodeURIComponent(CONTACT_AUTH_SELECT)', 'encodeURIComponent(CONTACT_AUTH_SELECT.replace(/\\s+/g, ""))');
source = source.replaceAll('encodeURIComponent(CONTACT_DASHBOARD_SELECT)', 'encodeURIComponent(CONTACT_DASHBOARD_SELECT.replace(/\\s+/g, ""))');
source = source.replaceAll('encodeURIComponent(CHECKIN_STATUS_SELECT)', 'encodeURIComponent(CHECKIN_STATUS_SELECT.replace(/\\s+/g, ""))');
fs.writeFileSync(zohoFile, source);

const mappingFile = 'src/lib/field-mapping.ts';
if (!fs.existsSync(mappingFile)) throw new Error('field-mapping.ts missing after bootstrap');
let mapping = fs.readFileSync(mappingFile, 'utf8');
mapping = mapping.replace('[f.contact]: ctx.contactId,', '[f.contact]: { id: ctx.contactId },');
mapping = mapping.replace('[f.submittedAt]: new Date().toISOString(),', '[f.submittedAt]: new Date().toISOString().replace(/\\.\\d{3}Z$/, "+00:00"),');
fs.writeFileSync(mappingFile, mapping);

const dashboardFile = 'src/app/dashboard/page.tsx';
fs.mkdirSync('src/app/dashboard', { recursive: true });
fs.writeFileSync(dashboardFile, `"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = Record<string, any>;

function money(v: unknown) {
  if (v === null || v === undefined || v === "") return "Not updated";
  const n = Number(v);
  return Number.isFinite(n) ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n) : String(v);
}
function text(v: unknown) { return v === null || v === undefined || v === "" ? "Not updated" : String(v); }
function Row({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"/><div className="min-w-0 flex-1"><p className="text-sm text-slate-500">{label}</p><p className={\`mt-0.5 text-[15px] font-medium \${tone ? "text-emerald-700" : "text-slate-900"}\`}>{value}</p></div></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <details open className="group border-b border-slate-200 py-2"><summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-[15px] font-semibold text-slate-900"><span className="text-slate-400 transition group-open:rotate-90">›</span>{title}</summary><div className="ml-5 border-l border-slate-200 pl-5">{children}</div></details>;
}
export default function DashboardPage() {
  const router = useRouter();
  const [c, setC] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/customer', { cache: 'no-store' }).then(async r => { if (r.status === 401) { router.replace('/'); return null; } if (!r.ok) throw new Error(); return r.json(); }).then(j => { if (j) setC(j.customer ?? j); }).catch(() => {}).finally(() => setLoading(false)); }, [router]);
  if (loading) return <div className="mx-auto max-w-3xl py-16 text-sm text-slate-500">Loading your HappyCoin plan…</div>;
  if (!c) return <div className="mx-auto max-w-3xl py-16"><p className="text-sm text-slate-600">We couldn't load your plan.</p></div>;
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.fullName || 'HappyCoin Client';
  const rm = c.relationshipManager || c.owner || c.Owner || {};
  return <div className="mx-auto w-full max-w-3xl pb-10">
    <div className="mb-7 border-b border-slate-200 pb-5"><p className="text-xs font-medium uppercase tracking-[.16em] text-slate-400">My Financial Plan</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{name}</h1><p className="mt-1 text-sm text-slate-500">Your HappyCoin financial protection & wealth plan</p></div>
    <div className="rounded-xl border border-slate-200 bg-white px-5 shadow-sm sm:px-7">
      <Section title="1. Emergency Fund"><Row label="Emergency Fund" value={money(c.emergencyFund)} /></Section>
      <Section title="2. Life Protection"><Row label="Term Insurance" value={text(c.termInsurance)} tone/><Row label="Term Insurance Cover / Amount" value={money(c.termInsuranceAmount)} /><Row label="Term Insurance Premium" value={money(c.termInsurancePremium)} /><Row label="Disability Rider Premium" value={money(c.disabilityRiderPremium)} /><Row label="Critical Illness Premium" value={money(c.criticalIllnessPremium)} /></Section>
      <Section title="3. Health Protection"><Row label="Self Health Insurance" value={text(c.selfHealthInsurance)} tone/><Row label="Self Health Coverage" value={money(c.selfHealthCoverage)} /><Row label="Self Health Premium" value={money(c.selfHealthPremium)} /><Row label="Parents Health Insurance" value={text(c.parentsHealthInsurance)} tone/><Row label="Parents Health Coverage" value={money(c.parentsHealthCoverage)} /><Row label="Parents Health Premium" value={money(c.parentsHealthPremium)} /></Section>
      <Section title="4. Wealth Creation"><Row label="Mutual Fund SIP Target" value={money(c.mfSipTarget)} /></Section>
      <Section title="5. Vehicle"><Row label="Vehicle Status" value={text(c.vehicleHad)} /></Section>
      <Section title="6. Your HappyCoin Relationship Manager"><Row label="Relationship Manager" value={text(rm.name || rm.fullName || rm.Name || c.ownerName)} /><Row label="Email" value={text(rm.email || rm.Email || c.rmEmail)} /><Row label="Mobile" value={text(rm.mobile || rm.phone || rm.Mobile || c.rmMobile)} /></Section>
    </div>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button onClick={() => router.push('/checkin')} className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">Start Monthly Client Care Check-in →</button><button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.replace('/'); }} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600">Sign out</button></div>
  </div>;
}
`);

console.log('Applied deterministic HappyCoin production postpatch + Workflowy dashboard');
