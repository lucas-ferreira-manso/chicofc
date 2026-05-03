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

// Handler para Android/Desktop via Firebase
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || '⚽ Chico FC'
  const body = payload.notification?.body || 'Você tem uma nova notificação'
  self.registration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    data: payload.data
  })
})

// Handler nativo para iOS (Web Push padrão)
self.addEventListener('push', event => {
  if (!event.data) return
  
  let title = '⚽ Chico FC'
  let body = 'Você tem uma nova notificação'
  
  try {
    const data = event.data.json()
    title = data.notification?.title || data.title || title
    body = data.notification?.body || data.body || body
  } catch {
    body = event.data.text() || body
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
    })
  )
})

// Clique na notificação — abre o app
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})
