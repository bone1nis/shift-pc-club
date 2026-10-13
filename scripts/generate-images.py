#!/usr/bin/env python3
"""Генерирует иллюстрации галереи сайта (SVG) для демонстрационного клуба SHIFT.

Картинки вымышленные и рисуются кодом, поэтому не содержат чужих прав и персональных данных.
Запуск: python3 scripts/generate-images.py
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'apps/web/public/images/gallery'
W, H = 1200, 800
ACID = '#dbff00'

DEFS = f'''<defs>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0"/></filter>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15180f"/><stop offset="1" stop-color="#0b0c0a"/></linearGradient>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1112"/><stop offset="1" stop-color="#191c14"/></linearGradient>
  <linearGradient id="screenBlue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d5b9a"/><stop offset=".55" stop-color="#14305a"/><stop offset="1" stop-color="#0a1a33"/></linearGradient>
  <linearGradient id="screenGreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fd10a"/><stop offset=".5" stop-color="#3f6b0c"/><stop offset="1" stop-color="#16280a"/></linearGradient>
  <linearGradient id="screenAmber" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset=".5" stop-color="#9a4a12"/><stop offset="1" stop-color="#2a1408"/></linearGradient>
  <radialGradient id="spot" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>'''


def svg(body: str, title: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="{title}">'
        f'{DEFS}<rect width="{W}" height="{H}" fill="#0c0d0c"/>{body}'
        f'<rect width="{W}" height="{H}" filter="url(#grain)"/></svg>'
    )


def glow(shape: str, color: str, opacity: float = 0.8) -> str:
    return f'<g filter="url(#glow)" opacity="{opacity}" fill="{color}" stroke="{color}">{shape}</g>'


def monitor(cx: float, y: float, w: float, grad: str, tilt: float = 0, game: bool = True) -> str:
    h = w * 0.58
    x = cx - w / 2
    parts = [
        f'<g transform="rotate({tilt} {cx} {y + h})">',
        f'<rect x="{x - 3}" y="{y - 3}" width="{w + 6}" height="{h + 6}" rx="{w * 0.025}" fill="#06070a" stroke="#2a2f2f"/>',
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{w * 0.02}" fill="url(#{grad})"/>',
    ]
    if game:
        # условная сцена игры: горизонт, «горы» и HUD
        parts.append(f'<path d="M{x} {y + h * .68} L{x + w * .22} {y + h * .42} L{x + w * .4} {y + h * .62} L{x + w * .62} {y + h * .3} L{x + w} {y + h * .64} L{x + w} {y + h} L{x} {y + h}Z" fill="#000" opacity=".28"/>')
        parts.append(f'<rect x="{x + w * .06}" y="{y + h * .08}" width="{w * .22}" height="{h * .05}" rx="2" fill="#fff" opacity=".55"/>')
        parts.append(f'<circle cx="{x + w * .5}" cy="{y + h * .5}" r="{w * .018}" fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"/>')
    parts.append(f'<rect x="{cx - w * .05}" y="{y + h + 3}" width="{w * .1}" height="{h * .18}" fill="#14171a"/>')
    parts.append(f'<rect x="{cx - w * .18}" y="{y + h + 3 + h * .18}" width="{w * .36}" height="{h * .03}" rx="2" fill="#1c2024"/></g>')
    return ''.join(parts)


def chair(cx: float, y: float, s: float, accent: str = ACID) -> str:
    return (
        f'<g transform="translate({cx} {y}) scale({s})">'
        f'<rect x="-34" y="0" width="68" height="112" rx="26" fill="#0d0f10" stroke="#262b2b" stroke-width="3"/>'
        f'<rect x="-9" y="8" width="18" height="88" rx="6" fill="{accent}" opacity=".85"/>'
        f'<rect x="-44" y="108" width="88" height="22" rx="10" fill="#121516" stroke="#262b2b" stroke-width="3"/>'
        f'<rect x="-6" y="130" width="12" height="40" fill="#1a1d1f"/>'
        f'<path d="M-46 176 L0 166 L46 176" stroke="#1f2427" stroke-width="7" stroke-linecap="round" fill="none"/></g>'
    )


def keyboard(cx: float, y: float, w: float, color: str) -> str:
    keys = ''.join(
        f'<rect x="{cx - w / 2 + 6 + c * (w - 12) / 14}" y="{y + 5 + r * 9}" width="{(w - 12) / 14 - 2}" height="6" rx="1.5" fill="{color}" opacity=".85"/>'
        for r in range(3) for c in range(14)
    )
    return f'<rect x="{cx - w / 2}" y="{y}" width="{w}" height="34" rx="4" fill="#0a0b0c" stroke="#262b2b"/>{keys}'


def floor_grid(horizon: float, vanish_x: float = W / 2, color: str = '#2a3320') -> str:
    lines = []
    for i in range(-14, 15):
        lines.append(f'<line x1="{vanish_x}" y1="{horizon}" x2="{vanish_x + i * 190}" y2="{H}" stroke="{color}" stroke-width="1.2" opacity=".55"/>')
    for k in range(1, 9):
        t = (k / 9) ** 1.9
        y = horizon + (H - horizon) * t
        lines.append(f'<line x1="0" y1="{y:.1f}" x2="{W}" y2="{y:.1f}" stroke="{color}" stroke-width="1.2" opacity=".5"/>')
    return ''.join(lines)


def bokeh(seed: int, n: int, colors: list[str], y0: float = 0, y1: float = 380) -> str:
    rnd = random.Random(seed)
    return ''.join(
        f'<circle cx="{rnd.uniform(0, W):.0f}" cy="{rnd.uniform(y0, y1):.0f}" r="{rnd.uniform(6, 26):.0f}" fill="{rnd.choice(colors)}" opacity="{rnd.uniform(.06, .22):.2f}" filter="url(#glow)"/>'
        for _ in range(n)
    )


def arena() -> str:
    hz = 300
    body = [f'<rect width="{W}" height="{hz + 40}" fill="url(#wall)"/><rect y="{hz}" width="{W}" height="{H - hz}" fill="url(#floor)"/>']
    body.append(floor_grid(hz))
    body.append(glow(f'<rect x="80" y="86" width="1040" height="6" rx="3"/>', ACID, .7))
    body.append(f'<rect x="80" y="86" width="1040" height="4" rx="2" fill="{ACID}"/>')
    body.append(bokeh(3, 18, ['#3d82ff', ACID, '#ff4fa3'], 40, 300))
    # ряды: дальний -> ближний; кресло стоит перед монитором, зритель видит его спинку
    for row, (y, w, gap, count) in enumerate([(300, 84, 120, 9), (400, 116, 160, 7), (520, 164, 230, 5)]):
        total = (count - 1) * gap
        for i in range(count):
            cx = W / 2 - total / 2 + i * gap
            grad = ['screenBlue', 'screenGreen'][(i + row) % 2]
            h = w * .58
            body.append(glow(f'<rect x="{cx - w / 2}" y="{y}" width="{w}" height="{h}" rx="6"/>', '#4aa3ff' if grad == 'screenBlue' else '#9fd10a', .35))
            body.append(f'<rect x="{cx - w * .6}" y="{y + h + w * .1}" width="{w * 1.2}" height="{w * .08}" rx="3" fill="#101214" stroke="#262b2b"/>')
            body.append(monitor(cx, y, w, grad))
            body.append(chair(cx, y + h * .62, w / 190 * .8))
    return svg(''.join(body), 'Зал «Арена»: ряды игровых мест с мониторами')


def vip() -> str:
    body = [f'<rect width="{W}" height="{H}" fill="url(#wall)"/><rect y="560" width="{W}" height="240" fill="url(#floor)"/>']
    body.append(f'<ellipse cx="600" cy="560" rx="700" ry="90" fill="#2b1b0d" opacity=".5" filter="url(#soft)"/>')
    for i in range(5):
        x = 140 + i * 230
        body.append(glow(f'<rect x="{x}" y="70" width="130" height="5" rx="2.5"/>', '#ffb347', .8))
        body.append(f'<rect x="{x}" y="70" width="130" height="4" rx="2" fill="#ffd9a0"/>')
    body.append(bokeh(8, 14, ['#ffb347', '#ff7a3d', '#b86bff'], 90, 380))
    for i in range(4):
        cx = 215 + i * 257
        body.append(glow(f'<path d="M{cx - 110} 230 Q{cx} 205 {cx + 110} 230 L{cx + 110} 385 Q{cx} 360 {cx - 110} 385Z"/>', '#ffb347', .35))
        body.append(f'<path d="M{cx - 112} 226 Q{cx} 200 {cx + 112} 226 L{cx + 112} 388 Q{cx} 362 {cx - 112} 388Z" fill="#06070a" stroke="#2f2a24" stroke-width="3"/>')
        body.append(f'<path d="M{cx - 106} 232 Q{cx} 207 {cx + 106} 232 L{cx + 106} 382 Q{cx} 357 {cx - 106} 382Z" fill="url(#screenAmber)"/>')
        body.append(f'<path d="M{cx - 106} 360 L{cx - 50} 300 L{cx} 340 L{cx + 50} 280 L{cx + 106} 350 L{cx + 106} 382 Q{cx} 357 {cx - 106} 382Z" fill="#000" opacity=".3"/>')
        body.append(f'<rect x="{cx - 8}" y="388" width="16" height="48" fill="#17191b"/><rect x="{cx - 60}" y="434" width="120" height="8" rx="4" fill="#202427"/>')
        body.append(f'<rect x="{cx - 128}" y="470" width="256" height="26" rx="6" fill="#16120d" stroke="#3a2f22"/>')
        body.append(keyboard(cx - 20, 478, 118, '#ffb347'))
        body.append(f'<ellipse cx="{cx + 78}" cy="488" rx="14" ry="9" fill="#0a0b0c" stroke="#3a2f22"/>')
        # кресло-реклайнер
        body.append(f'<g transform="translate({cx} 520)"><rect x="-58" y="40" width="116" height="150" rx="40" fill="#241912" stroke="#4a3624" stroke-width="3"/><rect x="-70" y="100" width="140" height="44" rx="18" fill="#2c1e14" stroke="#4a3624" stroke-width="3"/></g>')
    return svg(''.join(body), 'Зал VIP: изогнутые мониторы и кресла-реклайнеры')


def reception() -> str:
    body = [f'<rect width="{W}" height="{H}" fill="url(#wall)"/><rect y="590" width="{W}" height="210" fill="url(#floor)"/>']
    body.append(glow('<text x="600" y="250" text-anchor="middle" font-family="Impact, Arial Narrow, sans-serif" font-size="190" font-weight="800">SHIFT.</text>', ACID, .65))
    body.append(f'<text x="600" y="250" text-anchor="middle" font-family="Impact, Arial Narrow, sans-serif" font-size="190" font-weight="800" fill="none" stroke="{ACID}" stroke-width="5">SHIFT.</text>')
    body.append(f'<path d="M430 120 L520 70 L520 98 L560 98" stroke="{ACID}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>')
    for i, (x, h) in enumerate([(70, 300), (1030, 300)]):
        for s in range(4):
            body.append(f'<rect x="{x}" y="{200 + s * 90}" width="100" height="8" rx="3" fill="#20252a"/>')
            for b in range(3):
                body.append(f'<rect x="{x + 8 + b * 30}" y="{160 + s * 90}" width="22" height="{40 + (b * 7 + s * 5) % 14}" rx="3" fill="{["#1c3a2a", "#2a2f4a", "#3a2a1c"][(b + s) % 3]}"/>')
    # стойка
    body.append('<path d="M180 520 L1020 520 L1060 600 L140 600Z" fill="#14171a" stroke="#2b3034" stroke-width="3"/>')
    body.append(f'<rect x="140" y="598" width="920" height="120" fill="#101315" stroke="#2b3034" stroke-width="3"/>')
    body.append(glow('<rect x="160" y="604" width="880" height="6" rx="3"/>', ACID, .8))
    body.append(f'<rect x="160" y="606" width="880" height="3" fill="{ACID}"/>')
    body.append(monitor(430, 410, 170, 'screenGreen', game=False))
    body.append(keyboard(430, 548, 110, ACID))
    body.append('<rect x="640" y="470" width="60" height="50" rx="6" fill="#0a0b0c" stroke="#2b3034"/>')
    body.append(f'<rect x="652" y="482" width="36" height="24" rx="3" fill="url(#screenBlue)"/>')
    # растение
    body.append('<g transform="translate(980 440)"><rect x="-26" y="70" width="52" height="64" rx="8" fill="#1b1f21" stroke="#2b3034"/>' + ''.join(f'<path d="M0 70 Q{dx} {30 - i * 6} {dx * 1.6} {-20 - i * 10}" stroke="#4d8f2b" stroke-width="9" fill="none" stroke-linecap="round"/>' for i, dx in enumerate([-60, -35, 0, 35, 60])) + '</g>')
    body.append(bokeh(5, 10, ['#3d82ff', ACID], 100, 500))
    return svg(''.join(body), 'Ресепшен клуба SHIFT с неоновой вывеской')


def tournament() -> str:
    body = [f'<rect width="{W}" height="{H}" fill="#08090b"/>']
    for x, tilt in [(160, -18), (420, -8), (780, 8), (1040, 18)]:
        body.append(f'<path d="M{x} 0 L{x - 120 + tilt * 3} 560 L{x + 120 + tilt * 3} 560Z" fill="#9ad1ff" opacity=".07" filter="url(#soft)"/>')
    body.append(glow('<rect x="250" y="110" width="700" height="300" rx="10"/>', '#4aa3ff', .55))
    body.append('<rect x="244" y="104" width="712" height="312" rx="12" fill="#04050a" stroke="#2b3034" stroke-width="4"/>')
    body.append('<rect x="256" y="116" width="688" height="288" rx="6" fill="url(#screenBlue)"/>')
    body.append(f'<text x="600" y="228" text-anchor="middle" font-family="Impact, Arial Narrow, sans-serif" font-size="92" font-weight="800" fill="#fff">SHIFT CUP</text>')
    body.append(f'<text x="600" y="296" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" letter-spacing="10" fill="{ACID}">ФИНАЛ · ПЯТНИЦА 19:00</text>')
    body.append(f'<rect x="330" y="330" width="170" height="12" rx="6" fill="#fff" opacity=".6"/><rect x="700" y="330" width="170" height="12" rx="6" fill="{ACID}"/>')
    body.append('<path d="M120 460 L1080 460 L1140 520 L60 520Z" fill="#12151a" stroke="#2b3034" stroke-width="3"/>')
    for side, cx in enumerate([360, 840]):
        for i in range(2):
            x = cx - 100 + i * 140
            body.append(f'<rect x="{x - 50}" y="468" width="100" height="10" rx="3" fill="#1d2126"/>')
            body.append(monitor(x, 392, 100, 'screenGreen' if side else 'screenBlue', game=True))
    # зрители
    rnd = random.Random(11)
    for r in range(4):
        y = 590 + r * 52
        for c in range(26):
            x = 20 + c * 46 + (r % 2) * 23 + rnd.uniform(-4, 4)
            s = 1 + r * .12
            body.append(f'<circle cx="{x:.0f}" cy="{y - 24 * s:.0f}" r="{11 * s:.1f}" fill="#171b21" stroke="#2f3640"/><path d="M{x - 17 * s:.0f} {y + 26:.0f} Q{x:.0f} {y - 22 * s:.0f} {x + 17 * s:.0f} {y + 26:.0f}Z" fill="#171b21" stroke="#2f3640"/>')
    body.append(bokeh(2, 22, ['#4aa3ff', ACID, '#ff4fa3'], 20, 460))
    return svg(''.join(body), 'Турнир в клубе: сцена с большим экраном и зрителями')


def bar() -> str:
    body = [f'<rect width="{W}" height="{H}" fill="url(#wall)"/><rect y="610" width="{W}" height="190" fill="url(#floor)"/>']
    body.append(glow('<text x="600" y="150" text-anchor="middle" font-family="Impact, Arial Narrow, sans-serif" font-size="96" font-weight="800">REFILL BAR</text>', '#ff4fa3', .7))
    body.append('<text x="600" y="150" text-anchor="middle" font-family="Impact, Arial Narrow, sans-serif" font-size="96" font-weight="800" fill="none" stroke="#ff9bd0" stroke-width="3">REFILL BAR</text>')
    for s in range(2):
        body.append(f'<rect x="150" y="{240 + s * 110}" width="900" height="8" rx="3" fill="#232830"/>')
    palette = ['#2f8f5b', '#2a6bd1', '#d1572a', '#c9a227', '#8a3fd1', '#2fa7a7']
    for s in range(2):
        for b in range(15):
            x = 175 + b * 58
            h = 70 + (b * 13 + s * 7) % 30
            c = palette[(b + s * 2) % len(palette)]
            body.append(f'<rect x="{x}" y="{240 + s * 110 - h}" width="26" height="{h}" rx="8" fill="{c}" opacity=".85"/><rect x="{x + 8}" y="{240 + s * 110 - h - 16}" width="10" height="18" rx="3" fill="{c}"/><rect x="{x + 4}" y="{240 + s * 110 - h * .6}" width="6" height="{h * .4}" rx="3" fill="#fff" opacity=".25"/>')
    body.append('<rect x="100" y="470" width="1000" height="140" rx="10" fill="#14171a" stroke="#2b3034" stroke-width="3"/>')
    body.append(glow('<rect x="100" y="464" width="1000" height="7" rx="3"/>', ACID, .8))
    body.append(f'<rect x="100" y="466" width="1000" height="4" fill="{ACID}"/>')
    for i in range(5):
        x = 220 + i * 190
        body.append(f'<path d="M{x - 24} 400 L{x + 24} 400 L{x + 18} 464 L{x - 18} 464Z" fill="#9fd8ff" opacity=".35" stroke="#cfeaff"/>')
        body.append(f'<rect x="{x - 3}" y="352" width="6" height="52" fill="{palette[i % 6]}"/>')
    for i in range(6):
        x = 170 + i * 172
        body.append(f'<ellipse cx="{x}" cy="690" rx="46" ry="12" fill="#06070a"/><rect x="{x - 7}" y="640" width="14" height="52" fill="#2b3034"/><rect x="{x - 40}" y="620" width="80" height="26" rx="13" fill="#1d2227" stroke="#313840" stroke-width="2"/>')
    body.append(bokeh(9, 14, ['#ff4fa3', ACID, '#3d82ff'], 40, 420))
    return svg(''.join(body), 'Бар клуба с напитками и неоновой вывеской')


def gear() -> str:
    body = [f'<rect width="{W}" height="{H}" fill="#08090a"/>']
    body.append('<ellipse cx="600" cy="640" rx="620" ry="180" fill="#11160a" filter="url(#soft)"/>')
    body.append('<path d="M0 520 L1200 520 L1200 800 L0 800Z" fill="#0e1011"/>')
    body.append(f'<rect y="516" width="{W}" height="4" fill="{ACID}" opacity=".7"/>')
    # монитор крупным планом
    body.append(glow('<rect x="260" y="70" width="680" height="380" rx="14"/>', '#9fd10a', .35))
    body.append('<rect x="252" y="62" width="696" height="396" rx="16" fill="#05060a" stroke="#2b3034" stroke-width="4"/>')
    body.append('<rect x="266" y="76" width="668" height="368" rx="8" fill="url(#screenGreen)"/>')
    body.append('<path d="M266 380 L420 240 L540 330 L690 170 L934 340 L934 444 L266 444Z" fill="#000" opacity=".3"/>')
    for i, (label, val) in enumerate([('FPS', '240'), ('PING', '8 ms'), ('GPU', 'RTX')]):
        x = 296 + i * 150
        body.append(f'<rect x="{x}" y="96" width="132" height="54" rx="6" fill="#000" opacity=".45"/><text x="{x + 14}" y="118" font-family="Arial, sans-serif" font-size="14" fill="#cfe6a0" letter-spacing="2">{label}</text><text x="{x + 14}" y="142" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#fff">{val}</text>')
    body.append('<rect x="560" y="460" width="80" height="60" fill="#14171a"/><rect x="480" y="512" width="240" height="10" rx="5" fill="#1c2024"/>')
    # клавиатура с RGB
    kb_x, kb_y = 200, 580
    body.append(glow(f'<rect x="{kb_x}" y="{kb_y}" width="560" height="150" rx="14"/>', '#ff4fa3', .3))
    body.append(f'<rect x="{kb_x}" y="{kb_y}" width="560" height="150" rx="14" fill="#0a0b0c" stroke="#2b3034" stroke-width="3"/>')
    for r in range(5):
        for c in range(15):
            hue = (c * 24 + r * 10) % 360
            body.append(f'<rect x="{kb_x + 16 + c * 35.6:.1f}" y="{kb_y + 14 + r * 26}" width="30" height="21" rx="4" fill="hsl({hue} 90% 58%)" opacity=".92"/>')
    # мышь
    body.append(glow('<ellipse cx="900" cy="650" rx="56" ry="76"/>', ACID, .3))
    body.append('<ellipse cx="900" cy="650" rx="52" ry="72" fill="#0a0b0c" stroke="#2b3034" stroke-width="3"/><rect x="896" y="580" width="8" height="46" rx="4" fill="#dbff00"/><path d="M850 640 Q900 620 950 640" stroke="#2b3034" stroke-width="3" fill="none"/>')
    # гарнитура
    body.append('<path d="M980 520 Q1060 440 1130 520" stroke="#15181a" stroke-width="18" fill="none" stroke-linecap="round"/><rect x="960" y="500" width="40" height="80" rx="16" fill="#15181a" stroke="#2b3034" stroke-width="3"/><rect x="1110" y="500" width="40" height="80" rx="16" fill="#15181a" stroke="#2b3034" stroke-width="3"/>')
    body.append(f'<circle cx="980" cy="540" r="8" fill="{ACID}"/><circle cx="1130" cy="540" r="8" fill="{ACID}"/>')
    return svg(''.join(body), 'Крупным планом: монитор, клавиатура с подсветкой, мышь и гарнитура')


SCENES = {'arena': arena, 'vip': vip, 'reception': reception, 'tournament': tournament, 'bar': bar, 'gear': gear}

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for name, scene in SCENES.items():
        (OUT / f'{name}.svg').write_text(scene(), encoding='utf-8')
        print('written', OUT / f'{name}.svg')
