export async function enablePush(){
 const appId=import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID'],apiKey=import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY'],projectId=import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID'],vapidKey=import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY'];
 if(!appId||!apiKey||!projectId||!vapidKey)throw new Error('Update the Firebase connection and select Include web push to enable lock-screen alerts.');
 if(window.top!==window.self)throw new Error('Open Chorepot in its own tab to enable alerts.');
 const {getMessaging,getToken,isSupported}=await import('firebase/messaging');if(!('Notification' in window)||!await isSupported())throw new Error('This browser does not support alerts.');
 if(await Notification.requestPermission()!=='granted')throw new Error('Allow notifications in your browser’s site settings.');
 const config={appId,apiKey,projectId,messagingSenderId:appId.split(':')[1]??''};const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js?'+new URLSearchParams(config));const {initializeApp,getApps}=await import('firebase/app');return getToken(getMessaging(getApps()[0]??initializeApp(config)),{vapidKey,serviceWorkerRegistration:registration});
}
