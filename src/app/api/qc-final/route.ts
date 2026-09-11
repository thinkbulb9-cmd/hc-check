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
  findContactByEmail,
  getContactDashboardData,
  getUserById,
} from "@/lib/zoho";
import { mobilesMatch } from "@/lib/mobile-normalizer";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = "vaasu.challa9@gmail.com";
  const mobile = "8886962244";
  const contactId = "4116853000034084073";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const monthName = monthIndexToName(month);
  const qcKey = `QC-${contactId}-${Date.now()}`;
  let createdId: string | null = null;

  try {
    const contact = await findContactByEmail(email);
    const loginMatch = !!contact && contact.id === contactId && mobilesMatch(contact.Mobile, mobile);
    if (!loginMatch) {
      return NextResponse.json({ ok: false, stage: "login_match", contactFound: !!contact }, { status: 500 });
    }

    const dashboardContact = await getContactDashboardData(contactId);
    if (!dashboardContact) {
      return NextResponse.json({ ok: false, stage: "dashboard_contact" }, { status: 500 });
    }

    const ownerId = (dashboardContact.Owner as { id?: string } | null)?.id;
    const owner = ownerId ? await getUserById(ownerId) : null;
    if (!ownerId || !owner) {
      return NextResponse.json({ ok: false, stage: "relationship_manager" }, { status: 500 });
    }

    const before = await findCheckinByKey(qcKey);
    if (before) {
      return NextResponse.json({ ok: false, stage: "duplicate_precheck" }, { status: 500 });
    }

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

    const payload = buildCheckinRecordPayload(form, {
      contactId,
      checkInKey: qcKey,
      monthName,
      year,
      rm: owner,
    });

    const created = await createCheckinRecord(payload);
    createdId = created.id;
    const after = await findCheckinByKey(qcKey);
    if (!after || after.id !== created.id) {
      return NextResponse.json({ ok: false, stage: "create_readback", created: true }, { status: 500 });
    }

    await deleteCheckinRecord(created.id);
    createdId = null;

    return NextResponse.json({
      ok: true,
      stages: {
        loginMatch: true,
        dashboardContact: true,
        relationshipManager: true,
        duplicatePrecheck: true,
        createRecord: true,
        readBack: true,
        cleanupDelete: true,
      },
    });
  } catch (error) {
    if (createdId) {
      try { await deleteCheckinRecord(createdId); } catch {}
    }
    return NextResponse.json({
      ok: false,
      stage: "exception",
      error: error instanceof Error ? error.message : "unknown",
    }, { status: 500 });
  }
}
