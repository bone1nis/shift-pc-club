<script setup lang="ts">
import { computed } from 'vue'
import { useAsyncData, useHead, useRuntimeConfig } from '#imports'
import type { ApiResponse, Catalog } from '@shift/contracts'
import { useClubProfile } from '@fsd/entities/club'
import { FinalCta } from '@fsd/widgets/landing-cta'
import { ContactsSection } from '@fsd/widgets/landing-contacts'
import { FaqSection } from '@fsd/widgets/landing-faq'
import { GallerySection } from '@fsd/widgets/landing-gallery'
import { HardwareSection } from '@fsd/widgets/landing-hardware'
import { HeroSection } from '@fsd/widgets/landing-hero'
import { PricingSection } from '@fsd/widgets/landing-pricing'
import { StepsSection } from '@fsd/widgets/landing-steps'
import { ZonesSection } from '@fsd/widgets/landing-zones'

const config = useRuntimeConfig()
const { data: catalog } = await useAsyncData('club-catalog', async () => {
  const baseURL = import.meta.server ? config.apiInternalOrigin : config.public.apiBase || undefined
  return (await $fetch<ApiResponse<Catalog>>('/api/club/catalog', { baseURL })).data
})
const { data: profile } = await useClubProfile()

// Структурированные данные для поисковиков: тип, адрес, часы, телефон.
const structured = computed(() =>
  profile.value
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'EntertainmentBusiness',
        name: profile.value.name,
        description: profile.value.description,
        telephone: profile.value.phone,
        email: profile.value.email,
        image: '/og-image.png',
        address: {
          '@type': 'PostalAddress',
          addressLocality: profile.value.city,
          streetAddress: profile.value.address,
          addressCountry: 'RU',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: profile.value.latitude,
          longitude: profile.value.longitude,
        },
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '00:00',
          closes: '23:59',
        },
      })
    : '',
)
useHead({
  script: computed(() =>
    structured.value ? [{ type: 'application/ld+json', innerHTML: structured.value }] : [],
  ),
})
</script>

<template>
  <div class="landing">
    <HeroSection :seat-count="catalog?.workstations.length" />
    <ZonesSection :catalog="catalog" />
    <GallerySection />
    <HardwareSection :workstation="catalog?.workstations[0]" />
    <PricingSection :catalog="catalog" />
    <StepsSection />
    <ContactsSection :profile="profile" />
    <FaqSection />
    <FinalCta />
  </div>
</template>
