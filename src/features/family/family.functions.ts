import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Family, FamilyState } from './model';
export const getFamily = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {supabase,userId}=context;
 const {data:role,error}=await supabase.from('user_roles').select('*').eq('user_id',userId).maybeSingle();if(error)throw error;if(!role)return null;
 const {data:h,error:he}=await supabase.from('households').select('*').eq('id',role.household_id).single();if(he)throw he;
 const {data:roles,error:re}=await supabase.from('user_roles').select('*').eq('household_id',h.id);if(re)throw re;
 const {data:profiles,error:pe}=await supabase.from('profiles').select('*').in('id',(roles??[]).map(r=>r.user_id));if(pe)throw pe;
 return {id:h.id,name:h.name,code:h.code,state:h.state as unknown as FamilyState,userId,role:role.role,members:(roles??[]).map(r=>{const p=profiles?.find(p=>p.id===r.user_id);return {id:r.user_id,role:r.role,name:p?.name??'Family member',avatar:p?.avatar??'🌱'};})} satisfies Family;
});
export const performAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{action:string;payload:Record<string,string|number>})=>d).handler(async({data,context})=>{
 const {data:state,error}=await context.supabase.rpc('family_action',{action:data.action,payload:data.payload});if(error)throw new Error(error.message);
 if(['complete','approve','reject'].includes(data.action)){
 const {data:mine}=await context.supabase.from('user_roles').select('*').eq('user_id',context.userId).single();
 if(mine){const {data:roles}=await context.supabase.from('user_roles').select('*').eq('household_id',mine.household_id);const ids=(roles??[]).filter(r=>data.action==='complete'?r.role!=='child':r.role==='child').map(r=>r.user_id);
 if(ids.length){const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {data:devices}=await supabaseAdmin.from('push_devices').select('*').in('user_id',ids);const key=process.env['FIREBASE_MESSAGING_API_KEY'],api=process.env['LOVABLE_API_KEY'];if(key&&api)await Promise.all((devices??[]).map(async(device)=>{try{const res=await fetch('https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send',{method:'POST',headers:{Authorization:`Bearer ${api}`,'X-Connection-Api-Key':key,'Content-Type':'application/json'},body:JSON.stringify({message:{token:device.token,notification:{title:'Chorepot',body:data.action==='complete'?'A chore is ready for your approval!':'Your chore has been reviewed.'},data:{path:'/dashboard'}}})});if(!res.ok){const body=await res.text();console.error('Push failed',res.status,body);if(body.includes('UNREGISTERED'))await supabaseAdmin.from('push_devices').delete().eq('token',device.token);}}catch(e){console.error('Push unavailable',e);}}));}}
 }
 return state as unknown as FamilyState;
});
