<script setup lang="ts">
import { SiteHeader, SiteFooter } from '@fsd/widgets/site-shell'
</script>
<template>
  <div>
    <SiteHeader />
    <main id="main"><slot /></main>
    <SiteFooter />
  </div>
</template>
