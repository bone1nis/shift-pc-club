<script setup lang="ts">
import { ref } from 'vue'
import { UiButton } from '@shift/ui'
import { Container, SectionHeading, vReveal } from '@fsd/shared/ui'
import { gallerySlides } from '../model/slides'

const track = ref<HTMLElement | null>(null)

function scrollBy(direction: 1 | -1) {
  const element = track.value
  if (!element) return
  const slide = element.querySelector<HTMLElement>('.gallery__slide')
  const step = (slide?.offsetWidth ?? element.clientWidth) + 16
  element.scrollBy({ left: direction * step, behavior: 'smooth' })
}
</script>

<template>
  <section id="gallery" class="gallery" aria-labelledby="gallery-title">
    <Container>
      <SectionHeading eyebrow="02 / Загляни внутрь">
        <template #title
          ><span id="gallery-title">Увидь <span class="outline">клуб.</span></span></template
        >
        Залы, бар, ресепшен и турнирная сцена. Иллюстрации демонстрационные.
      </SectionHeading>
      <div class="gallery__controls">
        <UiButton variant="ghost" size="sm" aria-label="Предыдущий кадр" @click="scrollBy(-1)"
          >←</UiButton
        >
        <UiButton variant="ghost" size="sm" aria-label="Следующий кадр" @click="scrollBy(1)"
          >→</UiButton
        >
      </div>
    </Container>
    <ul
      ref="track"
      class="gallery__track"
      role="list"
      tabindex="0"
      aria-label="Галерея клуба, прокручивается по горизонтали"
    >
      <li
        v-for="(slide, index) in gallerySlides"
        :key="slide.src"
        v-reveal="index"
        class="gallery__slide"
      >
        <figure>
          <img :src="slide.src" :alt="slide.alt" width="1200" height="800" loading="lazy" />
          <figcaption>
            <b>{{ slide.title }}</b>
            <span>{{ slide.caption }}</span>
          </figcaption>
        </figure>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.gallery {
  padding-top: 80px;
  padding-bottom: 48px;
  overflow: hidden;
}
.gallery__controls {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: -24px 0 19px;
}
.gallery__track {
  display: flex;
  gap: 16px;
  margin: 0;
  padding: 5px max(32px, calc((100vw - 1408px) / 2)) 16px;
  list-style: none;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: max(32px, calc((100vw - 1408px) / 2));
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}
.gallery__track {
  align-items: stretch;
}
.gallery__slide {
  display: flex;
  flex: 0 0 min(544px, 82vw);
  scroll-snap-align: start;
}
/* Все карточки одной высоты и ширины, независимо от длины подписи. */
.gallery figure {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  transition: border-color 0.2s;
}
.gallery figure:hover {
  border-color: var(--acid);
}
.gallery img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 2;
  object-fit: cover;
}
.gallery figcaption {
  flex: 1;
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 16px 19px 19px;
}
.gallery figcaption b {
  font-family: var(--font-display);
  font-size: var(--fs-24);
  text-transform: uppercase;
}
.gallery figcaption span {
  font-size: var(--fs-13);
  color: var(--muted);
}
@media (max-width: 760px) {
  .gallery {
    padding-top: 48px;
  }
  .gallery__controls {
    display: none;
  }
  .gallery__track {
    padding-inline: 16px;
    scroll-padding-inline: 16px;
  }
}
</style>
