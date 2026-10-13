export interface GallerySlide {
  src: string
  title: string
  caption: string
  alt: string
}

export const gallerySlides: GallerySlide[] = [
  {
    src: '/images/gallery/arena.svg',
    title: 'Арена',
    caption: '16 мест для катки с командой: мониторы 240 Гц и кресла с поддержкой спины.',
    alt: 'Зал «Арена»: ряды игровых мест, на мониторах игровые сцены',
  },
  {
    src: '/images/gallery/vip.svg',
    title: 'VIP',
    caption: 'Четыре места с изогнутыми мониторами 360 Гц и кожаными реклайнерами.',
    alt: 'Зал VIP: четыре изогнутых монитора с тёплой подсветкой и кресла',
  },
  {
    src: '/images/gallery/reception.svg',
    title: 'Ресепшен',
    caption: 'Администратор на смене круглосуточно: заселит, продлит время, подскажет по железу.',
    alt: 'Стойка администратора под неоновой вывеской SHIFT',
  },
  {
    src: '/images/gallery/tournament.svg',
    title: 'Турниры',
    caption: 'По пятницам и субботам — любительские турниры на большом экране.',
    alt: 'Сцена турнира: большой экран SHIFT CUP, четыре игровых места и зрители',
  },
  {
    src: '/images/gallery/bar.svg',
    title: 'Refill Bar',
    caption: 'Напитки и перекусы с десяти утра до четырёх ночи, не вставая с места.',
    alt: 'Барная стойка с бутылками и неоновой вывеской Refill Bar',
  },
  {
    src: '/images/gallery/gear.svg',
    title: 'Периферия',
    caption: 'Механические клавиатуры, лёгкие мыши и закрытые гарнитуры — всё включено в тариф.',
    alt: 'Крупным планом монитор, клавиатура с RGB-подсветкой, мышь и гарнитура',
  },
]
