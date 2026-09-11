import { NextResponse } from "next/server";
import {
  buildCheckinRecordPayload,
  monthIndexToName,
  type CheckinFormInput,
} from "@/lib/field-mapping";
import {
  createCheckinRecord,
  deleteCheckinRecord,
  findCheckinByKey,
  getContactDashboardData,
  getUserById,
} from "@/lib/zoho";

export const dynamic = "force-dynamic";

function normalizeMobile(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

export async function GET() {
  let stage = "start";
  let createdId: string | null = null;

  try {
    stage = "oauth";
    const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";
    const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) throw new Error("missing_oauth_env");

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
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
    if (!tokenRes.ok || !tokenJson.access_token) throw new Error("oauth_refresh_failed");
    const authHeader = { Authorization: "Zoho-oauthtoken " + tokenJson.access_token };

    stage = "candidate_contact";
    const listUrl = apiDomain + "/crm/v8/Contacts?fields=id,Email,Mobile,Phone,Home_Phone,Owner&per_page=25";
    const listRes = await fetch(listUrl, { headers: authHeader, cache: "no-store" });
    const listJson = (await listRes.json().catch(() => ({}))) as { data?: Array<Record<string, unknown>> };
    if (!listRes.ok) throw new Error("contact_list_failed");
    const candidates = Array.isArray(listJson.data) ? listJson.data : [];
    const candidate = candidates.find((row) => {
      const email = String(row.Email ?? "").trim();
      const mobile = normalizeMobile(row.Mobile) || normalizeMobile(row.Phone) || normalizeMobile(row.Home_Phone);
      return email.includes("@") && mobile.length === 10;
    });
    if (!candidate || typeof candidate.id !== "string") throw new Error("no_qc_candidate");

    const email = String(candidate.Email ?? "").trim().toLowerCase();
    const mobile = normalizeMobile(candidate.Mobile) || normalizeMobile(candidate.Phone) || normalizeMobile(candidate.Home_Phone);
    const contactId = candidate.id;

    stage = "auth_algorithm";
    const searchUrl = apiDomain + "/crm/v8/Contacts/search?email=" + encodeURIComponent(email) + "&fields=" + encodeURIComponent("id,Email,Mobile,Phone,Home_Phone,Owner");
    const searchRes = await fetch(searchUrl, { headers: authHeader, cache: "no-store" });
    const searchJson = (await searchRes.json().catch(() => ({}))) as { data?: Array<Record<string, unknown>> };
    if (!searchRes.ok) throw new Error("email_search_failed");
    const rows = Array.isArray(searchJson.data) ? searchJson.data : [];
    const matches = rows.filter((row) => {
      const emailOk = String(row.Email ?? "").trim().toLowerCase() === email;
      const storedMobile = normalizeMobile(row.Mobile) || normalizeMobile(row.Phone) || normalizeMobile(row.Home_Phone);
      return emailOk && storedMobile === mobile;
    });
    if (matches.length !== 1 || matches[0]?.id !== contactId) throw new Error("auth_algorithm_mismatch");

    stage = "dashboard";
    const dashboardContact = await getContactDashboardData(contactId);
    if (!dashboardContact) throw new Error("dashboard_contact_missing");

    stage = "relationship_manager";
    const ownerId = (dashboardContact.Owner as { id?: string } | null)?.id;
    const owner = ownerId ? await getUserById(ownerId) : null;
    if (!ownerId || !owner) throw new Error("relationship_manager_failed");

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "numeric",
    }).formatToParts(new Date());
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const monthName = monthIndexToName(month);
    const qcKey = `QC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    stage = "duplicate_precheck";
    const before = await findCheckinByKey(qcKey);
    if (before) throw new Error("unexpected_duplicate");

    const form: CheckinFormInput = {
      overallFamilyStatus: "Good",
      financialComfort: "Comfortable",
      majorChanges: ["No Major Changes"],
      assistanceRequired: ["Financial Goal Planning"],
      serviceRating: 5,
      teamResponsivenessRating: 5,
      adviceReceived: "Yes",
      wantTeamContact: "No",
      recommendHappyCoin: "No",
      suggestions: "Automated QC record; safe to delete.",
    };

    stage = "create_record";
    const payload = buildCheckinRecordPayload(form, {
      contactId,
      checkInKey: qcKey,
      monthName,
      year,
      rm: owner,
    });
    const created = await createCheckinRecord(payload);
    createdId = created.id;

    stage = "readback";
    const after = await findCheckinByKey(qcKey);
    if (!after || after.id !== created.id) throw new Error("readback_failed");

    stage = "cleanup";
    await deleteCheckinRecord(created.id);
    createdId = null;

    return NextResponse.json({
      ok: true,
      stages: [
        "oauth",
        "candidate_contact",
        "auth_algorithm",
        "dashboard",
        "relationship_manager",
        "duplicate_precheck",
        "create_record",
        "readback",
        "cleanup",
      ],
    });
  } catch (error) {
    if (createdId) {
      try { await deleteCheckinRecord(createdId); } catch {}
    }
    const e = error as { message?: string; code?: string; status?: number; details?: unknown };
    return NextResponse.json({
      ok: false,
      stage,
      error: e?.message ?? "unknown",
      code: e?.code ?? null,
      status: e?.status ?? null,
      details: e?.details ?? null,
    }, { status: 500 });
  }
}
