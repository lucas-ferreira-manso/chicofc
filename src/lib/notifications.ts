import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { initializeApp, getApps } from 'firebase/app'

const VAPID_KEY = 'BKPxqWzp9ACnjVVVH1dTJDtRUudQRWykGmbVVRuEzUtMLg158dvOXxQnk4C_xNZVof5TKHJ6yGVBRqe0TGk1jgw'

// Solicita permissão e salva token FCM no Firestore
export async function requestNotificationPermission(userId: string): Promise<boolean> {
  try {
    if (!('Notification' in window)) return false
    if (!('serviceWorker' in navigator)) return false

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const app = getApps()[0]
    const messaging = getMessaging(app)

    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (!token) return false

    // Salva token no Firestore
    await setDoc(doc(db, 'fcm_tokens', userId), {
      token,
      updatedAt: new Date().toISOString()
    })

    return true
  } catch (e) {
    console.error('Erro ao registrar notificação:', e)
    return false
  }
}

// Escuta notificações em foreground
export function listenForegroundMessages() {
  try {
    const app = getApps()[0]
    const messaging = getMessaging(app)
    onMessage(messaging, payload => {
      const { title, body } = payload.notification ?? {}
      if (title) {
        new Notification(title, { body, icon: '/logo.png' })
      }
    })
  } catch (e) {
    console.error('Erro ao escutar mensagens:', e)
  }
}
