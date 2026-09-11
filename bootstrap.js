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
console.log(`Restored ${Object.keys(data).length} HappyCoin source files`);
