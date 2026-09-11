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
let data;
try {
  data = JSON.parse(zlib.gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
} catch (error) {
  console.error('HappyCoin bootstrap restore failed:', error && error.message ? error.message : error);
  console.error(`Chunks read: ${chunks.length}; base64 length: ${encoded.length}`);
  throw error;
}
for (const [file, content] of Object.entries(data)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
console.log(`Restored ${Object.keys(data).length} HappyCoin source files`);
