importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyA50geUxPHTq9F0QEjndJCY_CNFLs-BMBU",
  authDomain: "chico-fc.firebaseapp.com",
  projectId: "chico-fc",
  storageBucket: "chico-fc.firebasestorage.app",
  messagingSenderId: "180840381405",
  appId: "1:180840381405:web:c051269124c16b2aa1d434"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification
  self.registration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png'
  })
})
