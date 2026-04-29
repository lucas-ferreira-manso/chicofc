import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updatePassword
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { Profile } from '../types'

interface AuthState {
  user: Profile | null
  loading: boolean
  setUser: (user: Profile | null) => void
  setLoading: (v: boolean) => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  fetchProfile: (userId: string, email: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),

  signIn: async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const ref = doc(db, 'players', result.user.uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await fbSignOut(auth)
        return { error: 'Jogador não encontrado. Fala com o admin.' }
      }
      const data = snap.data()
      if (!data.active) {
        await fbSignOut(auth)
        return { error: 'Seu acesso está desativado. Fala com o admin.' }
      }
      set({
        user: { id: result.user.uid, email, ...data } as Profile,
        loading: false
      })
      return { error: null }
    } catch (e: any) {
      const msg = e.code === 'auth/invalid-credential'
        ? 'Email ou senha incorretos.'
        : 'Erro ao entrar. Tente novamente.'
      return { error: msg }
    }
  },

  signOut: async () => {
    await fbSignOut(auth)
    set({ user: null })
  },

  fetchProfile: async (userId: string, email: string) => {
    const ref = doc(db, 'players', userId)
    const snap = await getDoc(ref)
    if (snap.exists() && snap.data().active) {
      set({ user: { id: userId, email, ...snap.data() } as Profile, loading: false })
    } else {
      await fbSignOut(auth)
      set({ user: null, loading: false })
    }
  }
}))
