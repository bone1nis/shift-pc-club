<script setup lang="ts">
import { computed, ref } from 'vue'
import { UiButton, UiIcon, UiPanel } from '@shift/ui'
import type { ClubProfile } from '@shift/contracts'
import { Container, LinkButton, SectionHeading, vReveal } from '@fsd/shared/ui'
import ClubMap from './ClubMap.vue'

const props = defineProps<{ profile: ClubProfile | null | undefined }>()
const copied = ref(false)
const fullAddress = computed(() =>
  props.profile ? `${props.profile.city}, ${props.profile.address}` : '',
)
const phoneHref = computed(() => `tel:${(props.profile?.phone ?? '').replace(/[^+\d]/g, '')}`)

async function copyAddress() {
  try {
    await navigator.clipboard.writeText(fullAddress.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2500)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <section id="contacts" class="contacts" aria-labelledby="contacts-title">
    <Container>
      <SectionHeading eyebrow="06 / Как нас найти">
        <template #title
          ><span id="contacts-title">Приходи <span class="outline">в гости.</span></span></template
        >
        Круглосуточно, без выходных. Адрес и контакты демонстрационные.
      </SectionHeading>
      <div v-if="profile" class="contacts__grid">
        <UiPanel v-reveal.left title="Адрес и часы работы">
          <address class="contacts__address">
            <b>{{ profile.name }}</b>
            <span>{{ fullAddress }}</span>
            <span class="contacts__landmark">{{ profile.landmark }}</span>
          </address>
          <div class="contacts__actions">
            <UiButton variant="secondary" size="sm" @click="copyAddress">
              {{ copied ? 'Адрес скопирован' : 'Скопировать адрес' }}
            </UiButton>
            <span class="sr-only" role="status">{{
              copied ? 'Адрес скопирован в буфер обмена' : ''
            }}</span>
          </div>
          <dl class="contacts__hours">
            <div v-for="row in profile.hours" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
          <p class="contacts__links">
            <a :href="phoneHref">{{ profile.phone }}</a>
            <a :href="`mailto:${profile.email}`">{{ profile.email }}</a>
          </p>
          <LinkButton to="/booking" block
            >Забронировать место <UiIcon name="arrow-up-right"
          /></LinkButton>
        </UiPanel>
        <ClubMap v-reveal.right :address="fullAddress" />
      </div>
    </Container>
  </section>
</template>

<style scoped>
.contacts {
  padding-top: 80px;
  padding-bottom: 48px;
}
.contacts__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 16px;
  align-items: start;
}
.contacts__address {
  display: grid;
  gap: 6px;
  font-style: normal;
}
.contacts__landmark {
  font-size: var(--fs-14);
  color: var(--muted);
}
.contacts__hours {
  display: grid;
  gap: 0;
  margin: 0;
}
.contacts__hours > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
  font-size: var(--fs-14);
}
.contacts__hours dt {
  color: var(--muted);
}
.contacts__hours dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
}
.contacts__links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 24px;
  font-weight: 700;
}
.contacts__links a {
  color: var(--acid);
}
.contacts__links a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
@media (max-width: 900px) {
  .contacts__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 760px) {
  .contacts {
    padding-top: 48px;
  }
}
</style>
