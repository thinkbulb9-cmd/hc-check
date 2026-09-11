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

const diagRoute = 'src/app/api/diag-login-match/route.ts';
fs.mkdirSync(path.dirname(diagRoute), { recursive: true });
fs.writeFileSync(diagRoute, `import { NextResponse } from "next/server";\n\nexport async function GET() {\n  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";\n  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";\n  const clientId = process.env.ZOHO_CLIENT_ID;\n  const clientSecret = process.env.ZOHO_CLIENT_SECRET;\n  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;\n  if (!clientId || !clientSecret || !refreshToken) return NextResponse.json({ok:false,stage:"env"},{status:500});\n  const tokenRes = await fetch(accountsUrl + "/oauth/v2/token", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({grant_type:"refresh_token",client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken}), cache:"no-store" });\n  const tokenJson:any = await tokenRes.json().catch(() => ({}));\n  if (!tokenJson.access_token) return NextResponse.json({ok:false,stage:"token",error:tokenJson.error ?? null},{status:500});\n  const expectedEmail = "vaasu.challa9@gmail.com";\n  const expectedMobile = "8886962244";\n  const emailUrl = apiDomain + "/crm/v8/Contacts/search?email=" + encodeURIComponent(expectedEmail) + "&fields=" + encodeURIComponent("id,First_Name,Last_Name,Email,Mobile,Phone,Home_Phone,Owner");\n  const res = await fetch(emailUrl,{headers:{Authorization:"Zoho-oauthtoken " + tokenJson.access_token},cache:"no-store"});\n  const json:any = await res.json().catch(() => ({}));\n  const rows = Array.isArray(json.data) ? json.data : [];\n  const normalizedMobile=(v:any)=>String(v??"").replace(/\\D/g,"").slice(-10);\n  return NextResponse.json({ok:res.ok,stage:"email-search",httpStatus:res.status,count:rows.length,code:json.code??null,message:json.message??null,rows:rows.slice(0,3).map((r:any)=>({id:r.id,emailPresent:!!r.Email,emailExact:String(r.Email??"").trim().toLowerCase()===expectedEmail,mobilePresent:!!r.Mobile,mobileExact:normalizedMobile(r.Mobile)===expectedMobile,phoneExact:normalizedMobile(r.Phone)===expectedMobile,homePhoneExact:normalizedMobile(r.Home_Phone)===expectedMobile,fieldKeys:Object.keys(r).filter((k)=>["Email","Mobile","Phone","Home_Phone"].includes(k))}))},{status:res.ok?200:500});\n}\n`);

console.log(`Restored ${Object.keys(data).length} HappyCoin source files`);
