import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA50geUxPHTq9F0QEjndJCY_CNFLs-BMBU",
  authDomain: "chico-fc.firebaseapp.com",
  projectId: "chico-fc",
  storageBucket: "chico-fc.firebasestorage.app",
  messagingSenderId: "180840381405",
  appId: "1:180840381405:web:c051269124c16b2aa1d434"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
