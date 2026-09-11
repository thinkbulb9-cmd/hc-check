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

const zohoFile = 'src/lib/zoho.ts';
if (fs.existsSync(zohoFile)) {
  let source = fs.readFileSync(zohoFile, 'utf8');
  source = source.replace(
    'import "server-only";',
    'import "server-only";\n\nprocess.env.ZOHO_ACCOUNTS_URL ||= "https://accounts.zoho.com";\nprocess.env.ZOHO_API_DOMAIN ||= "https://www.zohoapis.com";',
  );

  source = source.replace(
`export async function findContactByEmail(email: string): Promise<RawContactRecord | null> {
  const rows = await coql(
    \`select \${CONTACT_AUTH_SELECT} from Contacts where Email = '\${coqlString(email)}' limit 2\`,
  );
  if (rows.length !== 1) return null;
  return rows[0] as unknown as RawContactRecord;
}

export async function getContactDashboardData(contactId: string): Promise<RawContactRecord | null> {
  const rows = await coql(
    \`select \${CONTACT_DASHBOARD_SELECT} from Contacts where id = '\${coqlString(contactId)}' limit 1\`,
  );
  if (rows.length !== 1) return null;
  return rows[0] as unknown as RawContactRecord;
}`,
`export async function findContactByEmail(email: string): Promise<RawContactRecord | null> {
  const json = (await zohoFetch(
    \`/crm/v8/Contacts/search?email=\${encodeURIComponent(email)}&fields=\${encodeURIComponent(CONTACT_AUTH_SELECT)}\`,
    { method: "GET" },
  )) as { data?: RawContactRecord[] };
  const rows = json.data ?? [];
  const exact = rows.filter((row) => String(row.Email ?? "").trim().toLowerCase() === email.trim().toLowerCase());
  if (exact.length !== 1) return null;
  return exact[0] ?? null;
}

export async function getContactDashboardData(contactId: string): Promise<RawContactRecord | null> {
  const json = (await zohoFetch(
    \`/crm/v8/Contacts/\${encodeURIComponent(contactId)}?fields=\${encodeURIComponent(CONTACT_DASHBOARD_SELECT)}\`,
    { method: "GET" },
  )) as { data?: RawContactRecord[] };
  return json.data?.[0] ?? null;
}`,
  );

  source = source.replace(
`export async function findCheckinByKey(checkInKey: string): Promise<{ id: string } | null> {
  const rows = await coql(
    \`select \${CHECKIN_STATUS_SELECT} from \${MODULE_API_NAME} where \${CHECKIN_FIELDS.checkInKey} = '\${coqlString(
      checkInKey,
    )}' limit 1\`,
  );
  if (rows.length !== 1) return null;
  return { id: rows[0]!.id as string };
}`,
`export async function findCheckinByKey(checkInKey: string): Promise<{ id: string } | null> {
  const json = (await zohoFetch(
    \`/crm/v8/\${MODULE_API_NAME}/search?criteria=\${encodeURIComponent(\`(\${CHECKIN_FIELDS.checkInKey}:equals:\${checkInKey})\`)}&fields=\${encodeURIComponent(CHECKIN_STATUS_SELECT)}\`,
    { method: "GET" },
  )) as { data?: Array<{ id?: string }> };
  const rows = json.data ?? [];
  if (rows.length !== 1 || !rows[0]?.id) return null;
  return { id: rows[0].id };
}`,
  );

  fs.writeFileSync(zohoFile, source);
}

const verifyRoute = 'src/app/api/auth/verify/route.ts';
if (fs.existsSync(verifyRoute)) {
  let source = fs.readFileSync(verifyRoute, 'utf8');
  source = source.replace(
    'const RATE_LIMIT = { limit: 5, windowSeconds: 15 * 60 };',
    'const IP_RATE_LIMIT = { limit: 30, windowSeconds: 15 * 60 };\nconst IDENTITY_RATE_LIMIT = { limit: 8, windowSeconds: 15 * 60 };',
  );
  source = source.replace(
    'rateLimit(`auth:verify:ip:${ip}`, RATE_LIMIT.limit, RATE_LIMIT.windowSeconds)',
    'rateLimit(`auth:verify:ip:v2:${ip}`, IP_RATE_LIMIT.limit, IP_RATE_LIMIT.windowSeconds)',
  );
  source = source.replace(
    'rateLimit(`auth:verify:identity:${identityHash}`, RATE_LIMIT.limit, RATE_LIMIT.windowSeconds)',
    'rateLimit(`auth:verify:identity:v2:${identityHash}`, IDENTITY_RATE_LIMIT.limit, IDENTITY_RATE_LIMIT.windowSeconds)',
  );
  fs.writeFileSync(verifyRoute, source);
}

console.log(`Restored ${Object.keys(data).length} HappyCoin source files`);
