import { computed, type Ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRealtimeChannel } from '@shift/ui'
import { bookingChatChannel, chatMessageSchema } from '@shift/contracts'
import { useUserStore } from '@fsd/entities/user'
import { api } from '@fsd/shared/api'
import type { ChatConversation } from './useBookingChat'

/**
 * Счётчик непрочитанных для кнопки «Чат», пока панель закрыта. Хранится в том же кэше беседы,
 * что и у панели: открытая панель сама ведёт счёт и отправляет «прочитано».
 */
export function useChatUnread(bookingId: number, open: Ref<boolean>) {
  const queryClient = useQueryClient()
  const user = useUserStore()
  const key = ['booking-chat', bookingId, 'conversation']
  const query = useQuery({
    queryKey: key,
    queryFn: () => api<ChatConversation>(`/api/realtime/conversations/${bookingId}`),
    staleTime: 60_000,
    retry: false,
    // Лениво: пока панель закрыта, беседу не запрашиваем (у старых броней это были бы 403).
    // Счётчик показываем из кэша, который наполнила открытая панель.
    enabled: open,
  })
  useRealtimeChannel(bookingChatChannel(bookingId), '.message.sent', (payload) => {
    if (open.value) return
    const parsed = chatMessageSchema.safeParse(payload)
    if (!parsed.success || parsed.data.senderId === user.user?.id) return
    queryClient.setQueryData<ChatConversation>(key, (prev) =>
      prev ? { ...prev, unreadCount: (prev.unreadCount ?? 0) + 1 } : prev,
    )
  })
  return { unreadCount: computed(() => query.data.value?.unreadCount ?? 0) }
}
