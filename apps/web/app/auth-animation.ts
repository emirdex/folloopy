// Keep the existing sign-in animation timing consistent across account forms.
export async function withAuthAnimation<T>(operation:()=>Promise<T>):Promise<T>{
 const started=Date.now();
 try{return await operation()}
 finally{
  const remaining=2000-(Date.now()-started);
  if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
 }
}
