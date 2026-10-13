import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@shift/contracts'
import { api } from '@fsd/shared/api'
export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const loaded = ref(false)
  async function load() {
    try {
      user.value = await api<User>('/api/auth/me')
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }
  async function signIn(email: string, password: string) {
    user.value = await api<User>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    loaded.value = true
  }
  async function register(name: string, email: string, password: string) {
    user.value = await api<User>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, password_confirmation: password }),
    })
    loaded.value = true
  }
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    user.value = null
  }
  return { user, loaded, load, signIn, register, logout }
})
