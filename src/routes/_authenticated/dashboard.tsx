import {createFileRoute} from '@tanstack/react-router';
import {queryOptions,useSuspenseQuery} from '@tanstack/react-query';
import {Dashboard} from '@/features/family/dashboard';
import {getFamily} from '@/features/family/family.functions';
import {useState,useEffect,type FormEvent} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Sprout} from 'lucide-react';
import {toast} from 'sonner';
const familyQuery=queryOptions({queryKey:['family'],queryFn:()=>getFamily(),refetchInterval:15000});
export const Route=createFileRoute('/_authenticated/dashboard')({loader:({context})=>context.queryClient.ensureQueryData(familyQuery),head:()=>({meta:[{title:'Your family dashboard | Chorepot'},{name:'description',content:'Manage family chores, approve little wins and grow pocket money savings.'},{property:'og:title',content:'Your family dashboard | Chorepot'},{property:'og:description',content:'Chores, savings and little wins for your whole family.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:FamilyDashboard});
function FamilyDashboard(){const {data,refetch}=useSuspenseQuery(familyQuery);const [join,setJoin]=useState(false),[code,setCode]=useState(''),[busy,setBusy]=useState(false);useEffect(()=>{const invite=sessionStorage.getItem('family-invite');if(invite){setCode(invite);setJoin(true);}},[]);if(data)return <Dashboard family={data} onRefresh={()=>refetch()}/>;
 async function setup(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const f=new FormData(e.currentTarget);const {error}=await supabase.rpc('family_setup',join?{join_code:code}:{family_name:String(f.get('name'))});if(error)toast.error(error.message);else{sessionStorage.removeItem('family-invite');await refetch();}setBusy(false);}
 return <main className="setup-page"><section><span className="brand-mark"><Sprout/></span><h1>{join?'Your family is waiting':'Make yourself at home'}</h1><p>{join?'Enter your six-character family invite code.':'Give your happy little team a name.'}</p><form className="dialog-form" onSubmit={setup}>{join?<label>Family code<Input maxLength={6} minLength={6} required value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></label>:<label>Family name<Input name="name" placeholder="The Thompson family" required minLength={2}/></label>}<Button disabled={busy}>{join?'Join my family':'Create my family'}</Button></form><Button variant="link" onClick={()=>setJoin(!join)}>{join?'Start a new family instead':'Have a family invite code?'}</Button></section></main>;
}
