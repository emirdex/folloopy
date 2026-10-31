export type MessageRecipients={to:string[];cc:string[];bcc:string[];complete:boolean;source:'recorded'|'archive'|'bulk'|'unavailable'};
export type MessageInspection={
 message:{id:string;subject:string;state:string;provider:string;send_channel:string;created_at:string;sent_at:string|null;tracking_enabled:boolean;recipient_count:number;activity_count:number;first_activity_at:string|null;last_activity_at:string|null};
 recipients:MessageRecipients;
 openings:{first_at:string;last_at:string}[];
 fileEvents:{id:string;name:string;label:string;kind:string;source:string;page:number;seconds:number;created_at:string}[];
};
