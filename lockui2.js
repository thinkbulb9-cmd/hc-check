const fs=require('fs'),path=require('path'),zlib=require('zlib');
const blob=[1,2,3,4,5].map(i=>fs.readFileSync(`lockchunk${i}.txt`,'utf8').trim()).join('');
const files=JSON.parse(zlib.gunzipSync(Buffer.from(blob,'base64')).toString('utf8'));
for(const [p,s] of Object.entries(files)){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);}
let route=fs.readFileSync('src/app/api/checkin/submit/route.ts','utf8');
route=route.replace('error:"Please check the form for errors.",fieldErrors:p.error.flatten().fieldErrors','error:"Please complete the highlighted fields.",validationIssues:p.error.issues.map(i=>({field:i.path.join("."),message:i.message})');
route=route.replace('error:"Please complete the required fields.",validationIssues:p.error.issues.map(i=>({field:i.path.join("."),message:i.message})','error:"Please complete the highlighted fields.",validationIssues:p.error.issues.map(i=>({field:i.path.join("."),message:i.message})');
fs.writeFileSync('src/app/api/checkin/submit/route.ts',route);
fs.writeFileSync('src/app/checkin/page.tsx','"use client";\nimport {useEffect} from "react";import {useRouter} from "next/navigation";export default function CheckinRedirect(){const r=useRouter();useEffect(()=>{r.replace("/dashboard")},[r]);return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Opening dashboard…</div>}\n');
console.log('Applied locked HappyCoin centralized dashboard UI and check-in workflow v2');
