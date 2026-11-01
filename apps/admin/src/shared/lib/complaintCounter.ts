import { ref } from 'vue'
import { apiPage } from '../api'

/** Число новых жалоб для бейджа в меню (только владелец). Содержимое не используется, нужен только total. */
export const newComplaints = ref(0)

export async function refreshNewComplaints(): Promise<void> {
  try {
    const result = await apiPage<unknown[]>('/api/club/owner/complaints?status=new')
    newComplaints.value = result.meta.total ?? result.data.length
  } catch {
    // бейдж — подсказка, ошибка не должна мешать работе
  }
}
