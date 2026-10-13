<script setup lang="ts">
import { useRoute } from '#imports'
import { UiButton, UiEmpty, UiIcon, UiNotice, UiPanel, UiSkeleton } from '@shift/ui'
import { BookingCard } from '@fsd/entities/booking'
import { SessionCard, SessionHistoryTable } from '@fsd/entities/gaming-session'
import { NotificationList } from '@fsd/entities/notification'
import { CancelBookingButton } from '@fsd/features/cancel-booking'
import { ProfileForm } from '@fsd/features/edit-profile'
import { AuthSessionsList } from '@fsd/features/manage-auth-sessions'
import { RepeatBookingButton } from '@fsd/features/repeat-booking'
import { SignOutButtons } from '@fsd/features/sign-out'
import { Container, LinkButton } from '@fsd/shared/ui'
import { useAccount } from '../model/useAccount'

const route = useRoute()
const account = useAccount()
const {
  user,
  bookings,
  authSessions,
  notifications,
  loading,
  error,
  notice,
  now,
  active,
  history,
} = account
</script>

<template>
  <Container>
    <section class="account" :aria-busy="!user.loaded">
      <header class="account__heading">
        <div>
          <span class="account__eyebrow">Player hub / Личный кабинет</span>
          <h1>
            Привет,<br />
            <!-- Строка имени занимает место всегда (скрытый «Игрок.»), заглушка лежит поверх: высота заголовка не меняется. -->
            <span class="account__name" :class="{ 'account__name--loading': !user.loaded }">
              {{ user.loaded ? user.user?.name || 'игрок' : 'Игрок' }}.
              <UiSkeleton
                v-if="!user.loaded"
                class="account__name-skeleton"
                width="min(320px, 70%)"
                height="0.7em"
              />
            </span>
          </h1>
        </div>
        <LinkButton to="/booking">Новая бронь <UiIcon name="arrow-up-right" /></LinkButton>
      </header>
      <div class="account__notices">
        <UiNotice v-if="route.query.booked">
          Бронь №{{ route.query.booked }} подтверждена. До встречи в SHIFT!
        </UiNotice>
        <UiNotice v-if="notice">{{ notice }}</UiNotice>
        <UiNotice v-if="error" tone="error">
          {{ error }} <UiButton variant="ghost" size="sm" @click="account.load">Обновить</UiButton>
        </UiNotice>
      </div>
      <div class="account__grid">
        <div class="account__main">
          <h2 class="account__title">Текущая игра</h2>
          <!-- Пока данные грузятся, показываем те же панели с заглушкой: блоки не «прыгают» при появлении данных. -->
          <UiPanel v-if="loading || !active.length">
            <UiEmpty v-if="loading" role="status">
              <span class="sr-only">Загружаем сессии…</span>
              <UiSkeleton class="account__line" shape="text" width="70%" height="26px" />
            </UiEmpty>
            <UiEmpty v-else>
              Пока нет активных сессий. Администратор запустит игру, когда ты придёшь в клуб.
            </UiEmpty>
          </UiPanel>
          <div v-else class="account__stack">
            <SessionCard
              v-for="session in active"
              :key="session.id"
              :session="session"
              :now="now"
            />
          </div>

          <h2 class="account__title">Твои бронирования</h2>
          <UiPanel v-if="loading || !bookings.length">
            <UiEmpty v-if="loading">
              <UiSkeleton class="account__line" shape="text" width="60%" height="26px" />
            </UiEmpty>
            <UiEmpty v-else>Пока нет бронирований. Выбери свой первый сетап!</UiEmpty>
          </UiPanel>
          <div class="account__stack">
            <BookingCard v-for="booking in bookings" :key="booking.id" :booking="booking">
              <template #actions>
                <RepeatBookingButton :booking="booking" @failed="error = $event" />
                <CancelBookingButton
                  v-if="booking.status === 'confirmed'"
                  :booking-id="booking.id"
                  @cancelled="
                    (id) => {
                      notice = `Бронь №${id} отменена.`
                      account.load()
                    }
                  "
                  @failed="error = $event"
                />
              </template>
            </BookingCard>
          </div>

          <h2 class="account__title">Уведомления</h2>
          <NotificationList :items="notifications" :loading="loading" />

          <h2 class="account__title">История посещений</h2>
          <UiPanel v-if="loading || !history.length">
            <UiEmpty v-if="loading">
              <UiSkeleton class="account__line" shape="text" width="50%" height="26px" />
            </UiEmpty>
            <UiEmpty v-else>Завершённые игры появятся здесь.</UiEmpty>
          </UiPanel>
          <UiPanel v-else><SessionHistoryTable :sessions="history" /></UiPanel>
        </div>
        <aside class="account__profile">
          <UiPanel>
            <div class="account__avatar" aria-hidden="true">
              <UiSkeleton v-if="!user.loaded" shape="circle" width="100%" height="100%" />
              <template v-else>{{ user.user?.name.charAt(0) }}</template>
            </div>
            <h3>Профиль игрока</h3>
            <ProfileForm @saved="notice = 'Имя профиля сохранено.'" @failed="error = $event" />
            <hr class="account__divider" />
            <AuthSessionsList
              v-model="authSessions"
              @revoked="notice = 'Сеанс отозван. Если это была текущая вкладка, войдите снова.'"
              @failed="error = $event"
            />
            <SignOutButtons @failed="error = $event" />
          </UiPanel>
        </aside>
      </div>
    </section>
  </Container>
</template>

<style scoped>
.account {
  padding-top: 48px;
  padding-bottom: 80px;
}
.account__heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-bottom: 40px;
}
.account__eyebrow {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--acid);
}
.account__heading > div {
  min-width: 0;
}
.account__heading h1 {
  font-size: var(--fs-fluid-36-80);
  margin-top: 16px;
  /* Длинное имя («Администратор») переносится, а не раздвигает страницу вправо. */
  overflow-wrap: anywhere;
}
.account__name {
  position: relative;
}
.account__name--loading {
  color: transparent;
}
.account__name-skeleton {
  position: absolute;
  left: 0;
  top: 0.1em;
}
.account__line {
  display: block;
  margin: 0 auto;
}
.account__heading h1 span {
  color: var(--acid);
}
.account__notices {
  display: grid;
  gap: 12px;
  margin-bottom: 24px;
}
.account__notices:empty {
  display: none;
}
.account__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
}
.account__main {
  min-width: 0;
}
.account__title {
  font-size: var(--fs-32);
  margin: 32px 0 21px;
}
.account__title:first-child {
  margin-top: 0;
}
.account__stack {
  display: grid;
  gap: 21px;
}
.account__profile {
  position: sticky;
  top: 32px;
  align-self: start;
}
.account__avatar {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  background: var(--acid);
  color: var(--olive-7);
  font-family: var(--font-display);
  font-size: var(--fs-40);
  border-radius: 6px;
}
.account__divider {
  width: 100%;
  margin: 0;
  border: 0;
  border-top: 1px solid var(--line);
}
@media (max-width: 1050px) {
  .account__grid {
    grid-template-columns: minmax(0, 1fr) 272px;
  }
}
@media (max-width: 760px) {
  .account {
    padding-top: 32px;
  }
  .account__heading {
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .account__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .account__profile {
    position: static;
    order: -1;
  }
  .account__avatar {
    display: none;
  }
}
</style>
