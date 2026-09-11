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

// Redeploy marker: refresh production environment variables.
console.log(`Restored ${Object.keys(data).length} HappyCoin source files`);
