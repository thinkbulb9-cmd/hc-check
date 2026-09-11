import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json({ ok: false, stage: "env", hasClientId: !!clientId, hasClientSecret: !!clientSecret, hasRefreshToken: !!refreshToken }, { status: 500 });
  }
  const res = await fetch(accountsUrl + "/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ ok: res.ok && !!json.access_token, httpStatus: res.status, error: json.error ?? null, apiDomain: json.api_domain ?? null, tokenType: json.token_type ?? null, expiresIn: json.expires_in ?? null }, { status: res.ok && !!json.access_token ? 200 : 500 });
}
