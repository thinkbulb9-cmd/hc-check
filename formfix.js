const fs=require('fs');

fs.writeFileSync('src/lib/validation.ts', String.raw`import { z } from "zod";
import { ASSISTANCE_REQUIRED, FINANCIAL_COMFORT, MAJOR_CHANGES, OVERALL_FAMILY_STATUS, PREFERRED_COMMUNICATION, PREFERRED_CONTACT_TIMING, PREFERRED_TIME, YES_NO } from "./field-mapping";
import { normalizeIndianMobile } from "./mobile-normalizer";

export const loginSchema=z.object({
  email:z.string().trim().toLowerCase().min(1,"Email is required").email("Enter a valid email address"),
  mobile:z.string().trim().min(1,"Mobile number is required").transform((v,c)=>{const n=normalizeIndianMobile(v);if(!n){c.addIssue({code:z.ZodIssueCode.custom,message:"Enter a valid Indian mobile number"});return z.NEVER}return n})
});
export type LoginInput=z.infer<typeof loginSchema>;
export const checkinStatusSchema=z.object({year:z.number().int().min(2020).max(2100),month:z.number().int().min(1).max(12)});
export type CheckinStatusInput=z.infer<typeof checkinStatusSchema>;
const rating=z.coerce.number().int().min(1).max(5);
const referral=z.object({name:z.string().trim().min(1,"Referral name is required"),mobile:z.string().trim().transform((v,c)=>{const n=normalizeIndianMobile(v);if(!n){c.addIssue({code:z.ZodIssueCode.custom,message:"Enter a valid Indian mobile number"});return z.NEVER}return n})});

export const checkinFormSchema=z.object({
  overallFamilyStatus:z.enum(OVERALL_FAMILY_STATUS),
  financialComfort:z.enum(FINANCIAL_COMFORT),
  majorChanges:z.array(z.enum(MAJOR_CHANGES)).min(1,"Select at least one option"),
  otherMajorChange:z.string().trim().max(500).optional().default(""),
  assistanceRequired:z.array(z.enum(ASSISTANCE_REQUIRED)).min(1,"Select at least one option"),
  otherAssistance:z.string().trim().max(500).optional().default(""),
  serviceRating:rating,
  teamResponsivenessRating:rating,
  adviceReceived:z.enum(YES_NO),
  wantTeamContact:z.enum(YES_NO),
  preferredContactTiming:z.enum(PREFERRED_CONTACT_TIMING).optional(),
  preferredCommunication:z.enum(PREFERRED_COMMUNICATION).optional(),
  preferredTime:z.enum(PREFERRED_TIME).optional(),
  suggestions:z.string().trim().max(2000).optional().default(""),
  recommendHappyCoin:z.enum(YES_NO),
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
route=route.replace('event:"CHECKIN_UPDATED"','event:"CHECKIN_CREATED"').replace('event:"CHECKIN_SAVE_FAILED"','event:"CHECKIN_CREATE_FAILED"');
fs.writeFileSync('src/app/api/checkin/submit/route.ts',route);

let comp=fs.readFileSync('src/components/CheckinForm.tsx','utf8');
comp=comp.replace('recommendHappyCoin==="Yes"&&d.referrals.length<1','false&&d.recommendHappyCoin==="Yes"&&d.referrals.length<1');
comp=comp.replace('Please check the form for errors.','Please complete the highlighted required fields.');
fs.writeFileSync('src/components/CheckinForm.tsx',comp);

console.log('Applied HappyCoin form submission fix');