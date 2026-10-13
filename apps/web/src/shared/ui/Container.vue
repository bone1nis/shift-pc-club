<template>
  <div class="container"><slot /></div>
</template>

<style scoped>
.container {
  width: min(100% - 64px, 1408px);
  margin: auto;
}
@media (max-width: 700px) {
  .container {
    width: calc(100% - 32px);
  }
}
</style>
