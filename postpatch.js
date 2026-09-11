const fs = require('fs');

const zohoFile = 'src/lib/zoho.ts';
if (!fs.existsSync(zohoFile)) throw new Error('zoho.ts missing after bootstrap');
let source = fs.readFileSync(zohoFile, 'utf8');

// Zoho fields query parameter must be comma-separated without spaces.
source = source.replaceAll(
  'encodeURIComponent(CONTACT_AUTH_SELECT)',
  'encodeURIComponent(CONTACT_AUTH_SELECT.replace(/\\s+/g, ""))',
);
source = source.replaceAll(
  'encodeURIComponent(CONTACT_DASHBOARD_SELECT)',
  'encodeURIComponent(CONTACT_DASHBOARD_SELECT.replace(/\\s+/g, ""))',
);
source = source.replaceAll(
  'encodeURIComponent(CHECKIN_STATUS_SELECT)',
  'encodeURIComponent(CHECKIN_STATUS_SELECT.replace(/\\s+/g, ""))',
);

fs.writeFileSync(zohoFile, source);

const mappingFile = 'src/lib/field-mapping.ts';
if (!fs.existsSync(mappingFile)) throw new Error('field-mapping.ts missing after bootstrap');
let mapping = fs.readFileSync(mappingFile, 'utf8');

// Zoho lookup fields must be submitted as { id: "..." }, not a bare record ID.
mapping = mapping.replace(
  '[f.contact]: ctx.contactId,',
  '[f.contact]: { id: ctx.contactId },',
);

// Zoho datetime fields require RFC3339 without milliseconds and with an explicit offset.
mapping = mapping.replace(
  '[f.submittedAt]: new Date().toISOString(),',
  '[f.submittedAt]: new Date().toISOString().replace(/\\.\\d{3}Z$/, "+00:00"),',
);

fs.writeFileSync(mappingFile, mapping);

console.log('Applied deterministic HappyCoin production postpatch');
