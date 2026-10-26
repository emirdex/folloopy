export type PackageId='free'|'individual'|'team'|'business';
export const packagePolicies={
 free:{name:'Free',dailySingle:3,retentionDays:7,drafts:1,reminders:0,linkMailsMonthly:0,bulkMonthly:0,bulkDaily:0,extension:'basic',branding:true,csv:false,scheduling:false},
 individual:{name:'Essential',dailySingle:null,retentionDays:90,drafts:10,reminders:10,linkMailsMonthly:100,bulkMonthly:0,bulkDaily:0,extension:'detailed',branding:false,csv:true,scheduling:true},
 team:{name:'Signature',dailySingle:null,retentionDays:365,drafts:50,reminders:100,linkMailsMonthly:null,bulkMonthly:5000,bulkDaily:500,extension:'advanced',branding:false,csv:true,scheduling:true},
 business:{name:'Enterprise',dailySingle:null,retentionDays:365,drafts:50,reminders:100,linkMailsMonthly:null,bulkMonthly:5000,bulkDaily:500,extension:'advanced',branding:false,csv:true,scheduling:true}
} as const;
export function packagePolicy(plan:unknown){return typeof plan==='string'&&Object.hasOwn(packagePolicies,plan)?packagePolicies[plan as PackageId]:null}
