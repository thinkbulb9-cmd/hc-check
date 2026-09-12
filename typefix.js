const fs=require('fs');
const p='src/lib/field-mapping.ts';
let s=fs.readFileSync(p,'utf8');
s=s.replace('  referrals: Array<{ name: string; mobile: string }>;','  referrals?: Array<{ name: string; mobile: string }>;');
s=s.replace('input.referrals.length > 0','(input.referrals ?? []).length > 0');
s=s.replace('input.referrals.map((r, i) => (i + 1) + ". " + r.name)','(input.referrals ?? []).map((r, i) => (i + 1) + ". " + r.name)');
s=s.replace('input.referrals.map((r, i) => (i + 1) + ". " + r.mobile)','(input.referrals ?? []).map((r, i) => (i + 1) + ". " + r.mobile)');
fs.writeFileSync(p,s);
console.log('Applied referral compatibility type fix');