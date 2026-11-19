import {createFileRoute} from '@tanstack/react-router';
import {ResetPassword} from '@/features/family/auth-screen';
export const Route=createFileRoute('/reset-password')({head:()=>({meta:[{title:'Reset your password | Chorepot'},{name:'description',content:'Safely reset your Chorepot family account password.'},{property:'og:title',content:'Reset your password | Chorepot'},{property:'og:description',content:'A fresh start for your family account.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:ResetPassword});
