'use server';
import {accountApi,requirePanel} from '../account-api';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
export async function approveExtension(form:FormData){await requirePanel();let reason='';try{await accountApi('/api/extension/approve',{id:String(form.get('pair')||'')})}catch{reason='approval-failed'}revalidatePath('/panel');redirect('/panel?view=extensions&mode='+(reason||'extension-approved'))}
export async function revokeExtension(){await requirePanel();await accountApi('/api/extension/revoke',{});revalidatePath('/panel');redirect('/panel?view=extensions')}
