"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/csrf").then((r) => r.json()).then((d) => setCsrfToken(d.csrfToken)).catch(() => setError("Unable to load the page. Please refresh."));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) }, body: JSON.stringify({ email, mobile }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return; }
      router.push("/dashboard");
    } catch { setError("Something went wrong. Please try again."); } finally { setSubmitting(false); }
  }

  return <div className="card"><h1 className="mb-1 text-lg font-semibold text-slate-900">Welcome back</h1><p className="mb-6 text-sm text-slate-500">Enter the email and mobile number registered with HappyCoin to continue.</p><form onSubmit={handleSubmit} className="space-y-4" noValidate><div><label htmlFor="email" className="field-label">Email address</label><input id="email" type="email" autoComplete="email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><div><label htmlFor="mobile" className="field-label">Mobile number</label><input id="mobile" type="tel" autoComplete="tel" placeholder="9876543210" className="field-input" value={mobile} onChange={(e) => setMobile(e.target.value)} required /></div>{error && <p className="field-error">{error}</p>}<button type="submit" className="btn-primary" disabled={submitting || !csrfToken}>{submitting ? "Verifying…" : "Continue"}</button></form></div>;
}
