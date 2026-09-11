const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const chunks = [];
for (let i = 0; ; i++) {
  const file = `bootchunk${i}.txt`;
  if (!fs.existsSync(file)) break;
  chunks.push(fs.readFileSync(file, 'utf8').trim());
}
if (!chunks.length) throw new Error('No HappyCoin bootstrap chunks found');
const encoded = chunks.join('');
const data = JSON.parse(zlib.gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
for (const [file, content] of Object.entries(data)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// Production Zoho domains + REST reads (avoids COQL scope dependency).
const zohoFile = 'src/lib/zoho.ts';
if (fs.existsSync(zohoFile)) {
  let source = fs.readFileSync(zohoFile, 'utf8');
  source = source.replace(
    'import "server-only";',
    'import "server-only";\n\nprocess.env.ZOHO_ACCOUNTS_URL ||= "https://accounts.zoho.com";\nprocess.env.ZOHO_API_DOMAIN ||= "https://www.zohoapis.com";',
  );

  source = source.replace(
    /export async function findContactByEmail\([\s\S]*?\n}\n\nexport async function getContactDashboardData\([\s\S]*?\n}/,
`export async function findContactByEmail(email: string): Promise<RawContactRecord | null> {
  const fields = CONTACT_AUTH_SELECT.replace(/\\s+/g, "");
  const json = (await zohoFetch(
    \`/crm/v8/Contacts/search?email=\${encodeURIComponent(email)}&fields=\${encodeURIComponent(fields)}\`,
    { method: "GET" },
  )) as { data?: RawContactRecord[] };
  const rows = json.data ?? [];
  const wanted = email.trim().toLowerCase();
  const exact = rows.filter((row) => String(row.Email ?? "").trim().toLowerCase() === wanted);
  if (exact.length !== 1) return null;
  return exact[0] ?? null;
}

export async function getContactDashboardData(contactId: string): Promise<RawContactRecord | null> {
  const fields = CONTACT_DASHBOARD_SELECT.replace(/\\s+/g, "");
  const json = (await zohoFetch(
    \`/crm/v8/Contacts/\${encodeURIComponent(contactId)}?fields=\${encodeURIComponent(fields)}\`,
    { method: "GET" },
  )) as { data?: RawContactRecord[] };
  return json.data?.[0] ?? null;
}`,
  );

  source = source.replace(
    /export async function findCheckinByKey\([\s\S]*?\n}/,
`export async function findCheckinByKey(checkInKey: string): Promise<{ id: string } | null> {
  const fields = CHECKIN_STATUS_SELECT.replace(/\\s+/g, "");
  try {
    const json = (await zohoFetch(
      \`/crm/v8/\${MODULE_API_NAME}/search?criteria=\${encodeURIComponent(\`(\${CHECKIN_FIELDS.checkInKey}:equals:\${checkInKey})\`)}&fields=\${encodeURIComponent(fields)}\`,
      { method: "GET" },
    )) as { data?: Array<{ id?: string; Check_in_Key?: string }> };
    const rows = json.data ?? [];
    const exact = rows.find((row) => row.id && String(row.Check_in_Key ?? "") === checkInKey);
    if (exact?.id) return { id: exact.id };
  } catch (error) {
    if (!(error instanceof ZohoApiError && error.status === 204)) throw error;
  }

  // Zoho search indexing can lag just-created records. Fall back to the newest
  // records from the module and compare the unique key locally.
  const listFields = \`id,\${CHECKIN_FIELDS.checkInKey}\`;
  const list = (await zohoFetch(
    \`/crm/v8/\${MODULE_API_NAME}?fields=\${encodeURIComponent(listFields)}&per_page=200&sort_by=Modified_Time&sort_order=desc\`,
    { method: "GET" },
  )) as { data?: Array<{ id?: string; Check_in_Key?: string }> };
  const exact = (list.data ?? []).find(
    (row) => row.id && String(row.Check_in_Key ?? "") === checkInKey,
  );
  return exact?.id ? { id: exact.id } : null;
}`,
  );

  fs.writeFileSync(zohoFile, source);
}

// Authentication route uses direct Zoho REST lookup proven against live org.
const verifyRoute = 'src/app/api/auth/verify/route.ts';
fs.mkdirSync(path.dirname(verifyRoute), { recursive: true });
fs.writeFileSync(verifyRoute, `import { NextRequest, NextResponse } from "next/server";
import { GENERIC_AUTH_FAILURE_MESSAGE, getClientIp, hashRateLimitIdentifier, verifyCsrfToken } from "@/lib/auth";
import { logEvent } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

const IP_RATE_LIMIT = { limit: 30, windowSeconds: 15 * 60 };
const IDENTITY_RATE_LIMIT = { limit: 8, windowSeconds: 15 * 60 };

type ContactMatch = { id: string; Email?: string | null; Mobile?: string | null; Phone?: string | null; Home_Phone?: string | null };

function normalizeMobile(value: unknown): string {
  return String(value ?? "").replace(/\\D/g, "").slice(-10);
}

async function findExactContact(email: string, mobile: string): Promise<ContactMatch | null> {
  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Missing Zoho OAuth configuration");

  const tokenRes = await fetch(accountsUrl + "/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !tokenJson.access_token) throw new Error("Zoho token refresh failed");

  const fields = "id,First_Name,Last_Name,Email,Mobile,Phone,Home_Phone,Owner";
  const searchUrl = apiDomain + "/crm/v8/Contacts/search?email=" + encodeURIComponent(email) + "&fields=" + encodeURIComponent(fields);
  const res = await fetch(searchUrl, {
    headers: { Authorization: "Zoho-oauthtoken " + tokenJson.access_token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Zoho contact search failed");
  const json = (await res.json().catch(() => ({}))) as { data?: ContactMatch[] };
  const rows = Array.isArray(json.data) ? json.data : [];
  const wantedEmail = email.trim().toLowerCase();
  const wantedMobile = normalizeMobile(mobile);
  const matches = rows.filter((row) => {
    const emailOk = String(row.Email ?? "").trim().toLowerCase() === wantedEmail;
    const storedMobiles = [row.Mobile, row.Phone, row.Home_Phone].map(normalizeMobile).filter(Boolean);
    return emailOk && wantedMobile.length === 10 && storedMobiles.includes(wantedMobile);
  });
  return matches.length === 1 ? matches[0]! : null;
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const ip = await getClientIp();

  try {
    const rl = await rateLimit(\`auth:verify:ip:v4:\${ip}\`, IP_RATE_LIMIT.limit, IP_RATE_LIMIT.windowSeconds);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }
  } catch {
    logEvent({ event: "RATE_LIMIT_STORE_FAILED", status: "failure", requestId });
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  const csrfOk = await verifyCsrfToken(req.headers.get("x-csrf-token"));
  if (!csrfOk) {
    logEvent({ event: "AUTH_ATTEMPT_FAILED", status: "failure", requestId, detail: "csrf" });
    return NextResponse.json({ error: "Invalid request. Please refresh the page and try again." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    logEvent({ event: "AUTH_ATTEMPT_FAILED", status: "failure", requestId, detail: "validation" });
    return NextResponse.json({ error: GENERIC_AUTH_FAILURE_MESSAGE }, { status: 401 });
  }

  const { email, mobile } = parsed.data;
  const identityHash = hashRateLimitIdentifier(\`\${email}|\${mobile}\`);
  try {
    const rl = await rateLimit(\`auth:verify:identity:v4:\${identityHash}\`, IDENTITY_RATE_LIMIT.limit, IDENTITY_RATE_LIMIT.windowSeconds);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }
  } catch {
    logEvent({ event: "RATE_LIMIT_STORE_FAILED", status: "failure", requestId });
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  try {
    const contact = await findExactContact(email, mobile);
    if (!contact) {
      logEvent({ event: "AUTH_ATTEMPT_FAILED", status: "failure", requestId, detail: "no_match_v4" });
      return NextResponse.json({ error: GENERIC_AUTH_FAILURE_MESSAGE }, { status: 401 });
    }

    await createSession({ contactId: contact.id });
    logEvent({ event: "AUTH_SUCCESS", status: "success", requestId, contactId: contact.id });
    return NextResponse.json({ ok: true });
  } catch {
    logEvent({ event: "AUTH_ATTEMPT_FAILED", status: "failure", requestId, detail: "upstream_v4" });
    return NextResponse.json(
      { error: "We're unable to verify your details right now. Please try again shortly." },
      { status: 503 },
    );
  }
}
`);

// Remove temporary diagnostics except QC endpoints while final verification is active.
for (const diag of [
  'src/app/api/diag-login-match/route.ts',
  'src/app/api/diag-contact/route.ts',
  'src/app/api/diag-zoho/route.ts',
]) {
  if (fs.existsSync(diag)) fs.rmSync(path.dirname(diag), { recursive: true, force: true });
}

console.log(`Restored ${Object.keys(data).length} HappyCoin source files with production fixes`);
