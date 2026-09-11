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

// Production login protection: keep brute-force protection without locking an
// entire office/NAT/public IP after only five attempts. Identity limits remain tighter.
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

// Temporary production diagnostic: returns only safe Zoho connectivity/error metadata.
const diagRoute = 'src/app/api/__diag/zoho/route.ts';
fs.mkdirSync(path.dirname(diagRoute), { recursive: true });
fs.writeFileSync(diagRoute, `import { NextResponse } from "next/server";\nimport { findContactByEmail } from "@/lib/zoho";\n\nexport async function GET() {\n  try {\n    const contact = await findContactByEmail("vaasu.challa9@gmail.com");\n    return NextResponse.json({ ok: true, found: !!contact, contactId: contact?.id ?? null, accountsUrl: process.env.ZOHO_ACCOUNTS_URL ?? null, apiDomain: process.env.ZOHO_API_DOMAIN ?? null });\n  } catch (error) {\n    const e = error instanceof Error ? error : new Error(String(error));\n    return NextResponse.json({ ok: false, errorName: e.name, errorMessage: e.message, accountsUrl: process.env.ZOHO_ACCOUNTS_URL ?? null, apiDomain: process.env.ZOHO_API_DOMAIN ?? null }, { status: 500 });\n  }\n}\n`);

console.log(`Restored ${Object.keys(data).length} HappyCoin source files`);
