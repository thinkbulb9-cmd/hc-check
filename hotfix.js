const fs=require('fs');

fs.writeFileSync('src/lib/validation.ts', String.raw`import { z } from "zod";
import { ASSISTANCE_REQUIRED, FINANCIAL_COMFORT, MAJOR_CHANGES, OVERALL_FAMILY_STATUS, PREFERRED_COMMUNICATION, PREFERRED_CONTACT_TIMING, PREFERRED_TIME, YES_NO } from "./field-mapping";
import { normalizeIndianMobile } from "./mobile-normalizer";
export const loginSchema=z.object({email:z.string().trim().toLowerCase().min(1,"Email is required").email("Enter a valid email address"),mobile:z.string().trim().min(1,"Mobile number is required").transform((v,c)=>{const n=normalizeIndianMobile(v);if(!n){c.addIssue({code:z.ZodIssueCode.custom,message:"Enter a valid Indian mobile number"});return z.NEVER}return n})});
export type LoginInput=z.infer<typeof loginSchema>;
export const checkinStatusSchema=z.object({year:z.number().int().min(2020).max(2100),month:z.number().int().min(1).max(12)});
export type CheckinStatusInput=z.infer<typeof checkinStatusSchema>;
const rating=z.preprocess(v=>v===""||v===null||v===undefined?undefined:Number(v),z.number().int().min(1).max(5).optional());
const referral=z.object({name:z.string().trim().min(1,"Referral name is required"),mobile:z.string().trim().transform((v,c)=>{const n=normalizeIndianMobile(v);if(!n){c.addIssue({code:z.ZodIssueCode.custom,message:"Enter a valid Indian mobile number"});return z.NEVER}return n})});
const optionalEnum=(values:readonly string[])=>z.preprocess(v=>v===""||v===null?undefined:v,z.string().refine(v=>values.includes(v),"Invalid option").optional());
export const checkinFormSchema=z.object({
  overallFamilyStatus:z.string().refine(v=>OVERALL_FAMILY_STATUS.includes(v as any),"Select your overall family status"),
  financialComfort:z.string().refine(v=>FINANCIAL_COMFORT.includes(v as any),"Select your financial comfort"),
  majorChanges:z.array(z.string()).optional().default([]),
  otherMajorChange:z.string().trim().max(500).optional().default(""),
  assistanceRequired:z.array(z.string()).optional().default([]),
  otherAssistance:z.string().trim().max(500).optional().default(""),
  serviceRating:rating,
  teamResponsivenessRating:rating,
  adviceReceived:optionalEnum(YES_NO),
  wantTeamContact:optionalEnum(YES_NO),
  preferredContactTiming:optionalEnum(PREFERRED_CONTACT_TIMING),
  preferredCommunication:optionalEnum(PREFERRED_COMMUNICATION),
  preferredTime:optionalEnum(PREFERRED_TIME),
  suggestions:z.string().trim().max(2000).optional().default(""),
  recommendHappyCoin:optionalEnum(YES_NO),
  referrals:z.array(referral).optional().default([])
}).superRefine((d,c)=>{
  if(d.majorChanges.includes("Other")&&!d.otherMajorChange)c.addIssue({code:z.ZodIssueCode.custom,path:["otherMajorChange"],message:"Please describe the other change"});
  if(d.assistanceRequired.includes("Other")&&!d.otherAssistance)c.addIssue({code:z.ZodIssueCode.custom,path:["otherAssistance"],message:"Please describe the assistance needed"});
  if(d.wantTeamContact==="Yes"){
    if(!d.preferredContactTiming)c.addIssue({code:z.ZodIssueCode.custom,path:["preferredContactTiming"],message:"Select a contact timing"});
    if(!d.preferredCommunication)c.addIssue({code:z.ZodIssueCode.custom,path:["preferredCommunication"],message:"Select a communication method"});
    if(!d.preferredTime)c.addIssue({code:z.ZodIssueCode.custom,path:["preferredTime"],message:"Select a preferred time"});
  }
});
export type CheckinFormValidatedInput=z.infer<typeof checkinFormSchema>;
`);

let route=fs.readFileSync('src/app/api/checkin/submit/route.ts','utf8');
route=route.replace('buildCheckinRecordPayload(p.data,','buildCheckinRecordPayload(p.data as any,');
route=route.replace('error:"Please check the form for errors."','error:"Please complete the required fields.",validationIssues:p.error.issues.map(i=>({field:i.path.join("."),message:i.message}))');
route=route.replace('error:"Please complete the highlighted required fields."','error:"Please complete the required fields.",validationIssues:p.error.issues.map(i=>({field:i.path.join("."),message:i.message}))');
fs.writeFileSync('src/app/api/checkin/submit/route.ts',route);

let comp=fs.readFileSync('src/components/CheckinForm.tsx','utf8');
comp=comp.replace(/setError\(j\.error\|\|"Please complete the highlighted required fields\."\)/g,'setError((j.validationIssues?.length ? j.validationIssues.map((x:any)=>x.message).join(" • ") : j.error) || "Please complete the required fields.")');
comp=comp.replace(/setError\(j\.error\|\|"Please check the form for errors\."\)/g,'setError((j.validationIssues?.length ? j.validationIssues.map((x:any)=>x.message).join(" • ") : j.error) || "Please complete the required fields.")');
fs.writeFileSync('src/components/CheckinForm.tsx',comp);
console.log('Applied HappyCoin validation hotfix');
