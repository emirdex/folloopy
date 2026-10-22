import {createHash} from 'node:crypto';
// The shared API adds durable limits in application deployments. This bounded
// local guard also protects standalone marketing deployments without a database.
export class ContactThrottle{
 private attempts=new Map<string,{count:number;expires:number}>();
 allow(email:string,ip:string,now=Date.now()){
  for(const [id,value] of this.attempts)if(value.expires<=now)this.attempts.delete(id);
  const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
  const checks:[string,number][]=[['email:'+hash(email.trim().toLowerCase()),5],['ip:'+hash(ip),5],['global',50]];
  if(checks.some(([key,limit])=>(this.attempts.get(key)?.count||0)>=limit)||this.attempts.size>=10000)return false;
  for(const [key] of checks){const entry=this.attempts.get(key)||{count:0,expires:now+15*60*1000};entry.count++;this.attempts.set(key,entry)}
  return true;
 }
}
