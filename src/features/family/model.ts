export type Member = { id: string; name: string; avatar: string; role: string };
export type Chore = { id: string; title: string; childId: string; day: number; value: number; emoji: string; status: 'todo'|'pending'|'approved'|'rejected'; proof?: string; note?: string };
export type Goal = { id: string; childId: string; title: string; emoji: string; target: number; saved: number };
export type Entry = { id: string; childId: string; title: string; amount: number; type: string; date: string };
export type Notice = { id: string; title: string; message: string; childId: string; date: string };
export type FamilyState = { chores: Chore[]; goals: Goal[]; ledger: Entry[]; notifications: Notice[] };
export type Family = { id: string; name: string; code: string; state: FamilyState; members: Member[]; userId: string; role: string };
export const money = (p: number) => p > 0 && p < 100 ? `${p}p` : `£${(p/100).toFixed(2)}`;
export const balance = (state: FamilyState,id: string) => state.ledger.filter(e=>e.childId===id).reduce((sum,e)=>sum+e.amount,0);
export const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const today = () => (new Date().getDay()+6)%7;
const stamp = new Date().toISOString();
export const demo: Family = { id:'demo', name:'The Thompson family', code:'FAM246', userId:'parent',role:'primary_parent',members:[{id:'parent',name:'Sarah',avatar:'👩🏻',role:'primary_parent'},{id:'coparent',name:'James',avatar:'👨🏻',role:'co_parent'},{id:'oliver',name:'Oliver',avatar:'🧑🏼‍🚀',role:'child'},{id:'amelia',name:'Amelia',avatar:'👩🏻‍🎨',role:'child'}],state:{chores:[{id:'1',title:'Tidy your bedroom',childId:'oliver',day:today(),value:150,emoji:'🛏️',status:'pending'},{id:'2',title:'Finish English homework',childId:'amelia',day:today(),value:200,emoji:'📚',status:'pending'},{id:'3',title:'Feed Luna',childId:'oliver',day:today(),value:50,emoji:'🐈',status:'todo'},{id:'4',title:'Set the dinner table',childId:'amelia',day:today(),value:100,emoji:'🍽️',status:'todo'},{id:'5',title:'Put the recycling out',childId:'oliver',day:today(),value:100,emoji:'♻️',status:'approved'},{id:'6',title:'Water the plants',childId:'amelia',day:5,value:50,emoji:'🪴',status:'todo'},{id:'7',title:'Help wash the car',childId:'oliver',day:6,value:250,emoji:'🚙',status:'todo'}],goals:[{id:'g1',childId:'oliver',title:'New LEGO set',emoji:'🧱',target:3500,saved:1800},{id:'g2',childId:'amelia',title:'Art supplies',emoji:'🎨',target:2000,saved:1250}],ledger:[{id:'e1',childId:'oliver',title:'This week’s chores',amount:850,type:'earning',date:stamp},{id:'e2',childId:'amelia',title:'This week’s chores',amount:650,type:'earning',date:stamp},{id:'e3',childId:'oliver',title:'Previous savings',amount:1400,type:'earning',date:stamp},{id:'e4',childId:'amelia',title:'Previous savings',amount:1250,type:'earning',date:stamp}],notifications:[]}};
export function demoAction(state: FamilyState,action:string,payload:Record<string,unknown>): FamilyState {
 const s=structuredClone(state), chore=s.chores.find(c=>c.id===payload.id);
 if(action==='create_chore') s.chores.push({...payload,id:crypto.randomUUID(),status:'todo'} as Chore);
 if(chore && action==='complete') {chore.status='pending';chore.proof=payload.proof as string;s.notifications.push({id:crypto.randomUUID(),title:chore.title,message:'Ready for parent approval',childId:chore.childId,date:new Date().toISOString()});}
 if(chore && action==='approve' && chore.status==='pending') {chore.status='approved';s.ledger.push({id:crypto.randomUUID(),childId:chore.childId,title:chore.title,amount:chore.value,type:'earning',date:new Date().toISOString()});}
 if(chore && action==='reject') {chore.status='rejected';chore.note=String(payload.note);}
 if(action==='pay') {const id=String(payload.childId);const amount=balance(s,id); if(amount>0)s.ledger.push({id:crypto.randomUUID(),childId:id,title:'Pocket money paid',amount:-amount,type:'payment',date:new Date().toISOString()});}
 if(action==='goal') s.goals.push({...payload,id:crypto.randomUUID(),saved:0} as Goal);
 if(action==='allocate') {const g=s.goals.find(g=>g.id===payload.id);if(g){const used=s.goals.filter(x=>x.childId===g.childId).reduce((n,x)=>n+x.saved,0);const amount=Number(payload.amount);if(amount<=0||amount>balance(s,g.childId)-used)throw new Error('Not enough unallocated pocket money');g.saved=Math.min(g.target,g.saved+amount);}}
 return s;
}
