const fs=require('fs');
const p='src/app/dashboard/page.tsx';
let s=fs.readFileSync(p,'utf8');
s=s.replace("const nav=[['dashboard','▦','Dashboard'],['checkin','▣','Client Check-in'],['profile','○','My Profile'],['documents','□','Documents'],['resources','◇','Education & Resources'],['support','?','Support']];","const nav=[['dashboard','▦','Dashboard'],['checkin','▣','Client Check-in'],['profile','○','My Profile'],['documents','□','Documents'],['resources','◇','Education & Resources'],['support','?','Support']] as const;");
s=s.replace("name.split(' ').map(x=>x[0]).join('')","name.split(' ').map(x=>x.charAt(0)).join('')");
fs.writeFileSync(p,s);
console.log('Applied reference UI strict TypeScript fix');
