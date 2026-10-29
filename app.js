/* ═══════════════════════════════════════════════════════════════
   ROB ZAM · Compra venta de lavadoras y refrigeradores
   app.js · JavaScript vanilla, sin dependencias

   Índice
   1. Utilidades y configuración
   2. Enlaces de WhatsApp
   3. Texto por palabras y revelado con IntersectionObserver
   4. Motor de scroll (un solo bucle rAF, solo trabaja lo visible)
   5. Loader
   6. Navegación y menú móvil
   7. Efectos guiados por scroll (marquee, tarjetas, lona, anatomía, proceso)
   8. Librería de ilustraciones SVG
   9. Hero (canvas de burbujas, parallax, reloj de la lavadora)
   10. Diagnóstico rápido
   11. Catálogo
   12. FAQ, formulario y micro-interacciones
   13. Arranque
   ═══════════════════════════════════════════════════════════════ */
(() => {
    'use strict';

    clearTimeout(window.__rzFailsafe);

    /* ───────────── 1. UTILIDADES Y CONFIGURACIÓN ───────────── */
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const TAU = Math.PI * 2;

    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const WA_NUMBER = '525540199540'; // 55 4019 9540
    const waURL = msg => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

    /* ───────────── 2. ENLACES DE WHATSAPP ───────────── */
    // Cualquier elemento con data-wa recibe un enlace con el mensaje ya escrito.
    // El href base (sin texto) sigue funcionando si el JS no carga.
    function initWhatsAppLinks() {
        $$('[data-wa]').forEach(a => { a.href = waURL(a.dataset.wa); });
    }

    /* ───────────── 3. TEXTO POR PALABRAS Y REVELADO ───────────── */
    function splitWords(el) {
        let i = 0;
        const walk = node => {
            Array.from(node.childNodes).forEach(n => {
                if (n.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    n.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span');
                        const wi = document.createElement('span');
                        w.className = 'w'; wi.className = 'wi';
                        wi.style.setProperty('--wi', i++);
                        wi.textContent = part;
                        w.appendChild(wi);
                        frag.appendChild(w);
                    });
                    n.replaceWith(frag);
                } else if (n.nodeType === 1) {
                    walk(n);
                }
            });
        };
        walk(el);
    }

    function initReveal() {
        $$('[data-split]').forEach(splitWords);
        const hero = $('[data-hero-split]');
        if (hero) hero.style.setProperty('--base', '260ms');

        const targets = $$('[data-split]:not([data-hero-split]), [data-reveal]');
        if (reduce || !('IntersectionObserver' in window)) { targets.forEach(t => t.classList.add('is-in')); return; }
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                e.target.classList.add('is-in');
                io.unobserve(e.target);
            });
        }, { threshold: .18, rootMargin: '0px 0px -6% 0px' });
        targets.forEach(t => io.observe(t));
    }

    /* ───────────── 4. MOTOR DE SCROLL ─────────────
       Un único bucle requestAnimationFrame. Cada efecto se registra con su
       elemento; solo se actualiza mientras ese elemento está en pantalla
       (IntersectionObserver). Si nada se mueve, el bucle no hace trabajo.
       Los valores se suavizan con lerp para dar sensación de "movimiento lento". */
    const engine = {
        items: new Map(),
        anims: [],
        y: window.scrollY,
        vel: 0,
        vh: window.innerHeight,
        vw: window.innerWidth,
        dirty: true,
        settling: false,
        bar: $('#progress-bar'),
        nav: $('#nav'),
    };

    const engineIO = 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            entries.forEach(e => {
                const it = engine.items.get(e.target);
                if (!it) return;
                it.vis = e.isIntersecting;
                if (it.vis) engine.dirty = true;
            });
        }, { rootMargin: '25% 0px 25% 0px' })
        : null;

    function track(el, update) {
        if (!el) return;
        engine.items.set(el, { el, update, vis: !engineIO });
        if (engineIO) engineIO.observe(el);
    }

    function frame(now) {
        const y = window.scrollY;
        const dy = y - engine.y;
        engine.vel = lerp(engine.vel, dy, .2);
        engine.y = y;

        if (dy !== 0 || engine.dirty || engine.settling) {
            engine.dirty = false;
            let settling = false;

            if (engine.bar) {
                const max = Math.max(1, document.documentElement.scrollHeight - engine.vh);
                engine.bar.style.transform = `scaleX(${clamp(y / max)})`;
            }
            if (engine.nav) engine.nav.classList.toggle('is-scrolled', y > 16);

            engine.items.forEach(it => {
                if (it.vis && it.update(y, now)) settling = true;
            });
            engine.settling = settling;
        }
        for (let i = 0; i < engine.anims.length; i++) engine.anims[i](now);
        requestAnimationFrame(frame);
    }

    function onResize() {
        engine.vh = window.innerHeight;
        engine.vw = window.innerWidth;
        engine.dirty = true;
    }

    /* ───────────── 5. LOADER ─────────────
       La puerta de una lavadora se llena de agua, el aro se completa y,
       al llegar al 100 %, la puerta se abre (máscara circular) revelando el sitio. */
    function runLoader(onReveal) {
        const loader = $('#loader');
        if (!loader) { onReveal(); return; }

        const ring = $('#loader-ring');
        const count = $('#loader-count');
        const tag = $('#loader-tag');
        const CIRC = 666;
        const MESSAGES = ['Revisando refrigeradores', 'Enjuagando detalles', 'Afinando refacciones', 'Todo listo'];
        const MIN_MS = reduce ? 250 : 2200;
        const MAX_MS = 6500;
        const t0 = performance.now();
        let loaded = document.readyState === 'complete';
        let shown = 0;
        let finished = false;
        if (!loaded) window.addEventListener('load', () => { loaded = true; }, { once: true });

        const open = () => {
            if (reduce) { loader.classList.add('is-done'); root.classList.remove('is-loading'); onReveal(); return; }
            const dur = 1150;
            const reach = Math.hypot(engine.vw / 2, engine.vh * .6) + 24;
            const start = performance.now();
            let revealed = false;
            loader.classList.add('is-opening');
            const step = now => {
                const t = clamp((now - start) / dur);
                loader.style.setProperty('--iris', (easeInOut(t) * reach).toFixed(1));
                if (!revealed && t > .22) { revealed = true; root.classList.remove('is-loading'); onReveal(); }
                if (t < 1) requestAnimationFrame(step);
                else { loader.classList.add('is-done'); }
            };
            requestAnimationFrame(step);
        };

        const tick = now => {
            const elapsed = now - t0;
            const time = clamp(elapsed / MIN_MS);
            const cap = loaded || elapsed > MAX_MS ? 1 : .92;
            const target = Math.min(cap, easeOut(time));
            shown = Math.max(shown, lerp(shown, target, .18));
            const pct = Math.min(100, Math.round(shown * 100 + (shown > .995 ? 1 : 0)));
            count.textContent = pct;
            ring.style.strokeDashoffset = (CIRC * (1 - shown)).toFixed(1);
            tag.textContent = MESSAGES[Math.min(3, Math.floor(shown * 3.99))];
            if (!finished && shown >= .995 && cap === 1 && time >= 1) {
                finished = true;
                count.textContent = '100';
                ring.style.strokeDashoffset = '0';
                tag.textContent = MESSAGES[3];
                setTimeout(open, 260);
                return;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    /* ───────────── 6. NAVEGACIÓN Y MENÚ MÓVIL ───────────── */
    function initNav() {
        const toggle = $('#nav-toggle');
        const menu = $('#menu');
        if (toggle && menu) {
            const setOpen = open => {
                toggle.setAttribute('aria-expanded', String(open));
                toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
                menu.setAttribute('aria-hidden', String(!open));
                menu.classList.toggle('is-open', open);
                root.classList.toggle('menu-open', open);
            };
            toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
            $$('[data-menu-link], .menu a.btn', menu).forEach(a => a.addEventListener('click', () => setOpen(false)));
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); toggle.focus(); } });
            window.matchMedia('(min-width: 1024px)').addEventListener('change', e => { if (e.matches) setOpen(false); });
        }

        // enlace activo según la sección visible
        const links = $$('.nav__links a');
        const map = new Map();
        links.forEach(a => { const s = $(a.getAttribute('href')); if (s) map.set(s, a); });
        if (!map.size || !('IntersectionObserver' in window)) return;
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                links.forEach(l => l.classList.remove('is-active'));
                const link = map.get(e.target);
                if (link) link.classList.add('is-active');   // secciones sin enlace (proceso, bento) apagan el resaltado
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        $$('main > section').forEach(s => io.observe(s));
    }

    /* ───────────── 7. EFECTOS GUIADOS POR SCROLL ───────────── */

    // 7.1 Marquee: se inclina según la velocidad del scroll (retroalimentación del movimiento)
    function initMarquee() {
        const el = $('#marquee');
        if (!el || reduce) return;
        let skew = 0;
        track(el, () => {
            const target = clamp(-engine.vel * .5, -9, 9);
            skew = lerp(skew, target, .14);
            el.style.setProperty('--skew', skew.toFixed(2) + 'deg');
            return Math.abs(skew) > .02 || Math.abs(engine.vel) > .05;
        });
    }

    // 7.2 Servicios: cada tarjeta se encoge y se atenúa cuando llega la siguiente (apilado real)
    function initStack() {
        const stack = $('#stack');
        const cards = $$('[data-card]', stack || document);
        if (!stack || cards.length < 2 || reduce) return;
        track(stack, () => {
            const navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 64;
            const approach = cards.map((c, j) => {
                const r = c.getBoundingClientRect();
                const stuck = navH + 22 + j * 14;
                return clamp(1 - (r.top - stuck) / Math.max(1, r.height * .9));
            });
            cards.forEach((c, i) => {
                let sum = 0;
                for (let j = i + 1; j < cards.length; j++) sum += approach[j];
                c.style.setProperty('--s', (1 - sum * .04).toFixed(4));
                c.style.setProperty('--b', (1 - sum * .05).toFixed(4));
            });
            return false;
        });
    }

    // 7.3 La lona: la foto real se abre de ventana pequeña a pantalla completa
    function initLona() {
        const sec = $('#lona');
        if (!sec) return;
        if (reduce) { sec.classList.add('is-pins'); return; }
        let e = 0, c = 0;
        track(sec, () => {
            const r = sec.getBoundingClientRect();
            const p = clamp(-r.top / Math.max(1, r.height - engine.vh));
            const tE = easeInOut(clamp(p / .6));
            const tC = clamp((p - .6) / .22);
            e = lerp(e, tE, .13); c = lerp(c, tC, .13);
            if (Math.abs(e - tE) < .0008) e = tE;
            if (Math.abs(c - tC) < .0008) c = tC;
            sec.style.setProperty('--e', e.toFixed(4));
            sec.style.setProperty('--c', c.toFixed(4));
            sec.classList.toggle('is-pins', c > .72);
            return e !== tE || c !== tC;
        });
    }

    // 7.4 Anatomía: la lavadora se "explota" pieza por pieza y se resalta cada una
    function initAnatomy() {
        const sec = $('#refacciones');
        const svg = $('#anat-svg');
        if (!sec || !svg) return;
        const parts = $$('.part', svg);
        const items = $$('#anat-list li');
        const MAX_GAP = 30;
        let gap = 0, active = -1;

        const setActive = i => {
            if (i === active) return;
            active = i;
            parts.forEach((p, k) => p.classList.toggle('is-active', k === i));
            items.forEach((li, k) => li.classList.toggle('is-active', k === i));
        };

        if (reduce) { svg.style.setProperty('--gap', MAX_GAP + 'px'); svg.classList.add('is-spread'); setActive(0); return; }
        svg.style.setProperty('--gap', '0px');
        setActive(0);

        track(sec, () => {
            const r = sec.getBoundingClientRect();
            const p = clamp(-r.top / Math.max(1, r.height - engine.vh));
            const tGap = easeInOut(clamp(p / .2)) * MAX_GAP;
            gap = lerp(gap, tGap, .12);
            if (Math.abs(gap - tGap) < .05) gap = tGap;
            svg.style.setProperty('--gap', gap.toFixed(2) + 'px');
            svg.classList.toggle('is-spread', gap > 2);
            setActive(clamp(Math.floor(clamp((p - .16) / .82) * parts.length), 0, parts.length - 1));
            return gap !== tGap;
        });
    }

    // 7.5 Proceso: la línea se rellena y cada paso se enciende al alcanzarlo
    function initProcess() {
        const wrap = $('#process');
        if (!wrap) return;
        const steps = $$('[data-step]', wrap);
        if (reduce) { wrap.style.setProperty('--p', 1); steps.forEach(s => s.classList.add('is-on')); return; }
        let cur = 0;
        track(wrap, () => {
            const r = wrap.getBoundingClientRect();
            const target = clamp((engine.vh * .78 - r.top) / (r.height + engine.vh * .12));
            cur = lerp(cur, target, .12);
            if (Math.abs(cur - target) < .001) cur = target;
            wrap.style.setProperty('--p', cur.toFixed(4));
            steps.forEach((s, k) => s.classList.toggle('is-on', cur > k / steps.length + .03));
            return cur !== target;
        });
    }

    /* ───────────── 8. LIBRERÍA DE ILUSTRACIONES SVG ─────────────
       Los degradados (gBody, gGlass, gWater...) viven en el bloque <svg class="svg-defs">
       del HTML. Cada función devuelve el contenido interno de un SVG; los
       compuestos de los servicios reutilizan los mismos aparatos. */
    let uid = 0;
    const wave = (y, w = 280) => `M0 ${y}q10-8 20 0${'t20 0'.repeat(Math.round(w / 20) - 1)}V${y + 90}H0z`;
    const svg = (vb, inner) => `<svg viewBox="${vb}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${inner}</svg>`;
    const feet = (y, x1, x2) => `<rect x="${x1}" y="${y}" width="26" height="6" rx="3" fill="#0A1450" opacity=".45"/><rect x="${x2}" y="${y}" width="26" height="6" rx="3" fill="#0A1450" opacity=".45"/>`;

    const washerFront = (dry = false) => {
        const u = ++uid;
        return `
        <clipPath id="ac${u}"><circle cx="110" cy="168" r="55"/></clipPath>
        <ellipse cx="110" cy="283" rx="88" ry="6" fill="#0A1450" opacity=".14"/>
        <rect x="10" y="6" width="200" height="272" rx="22" fill="url(#gBody)" stroke="#0A1450" stroke-opacity=".12"/>
        <path d="M10 28a22 22 0 0 1 22-22h156a22 22 0 0 1 22 22v38H10z" fill="url(#gPanel)"/>
        <path d="M10 66h200" stroke="#0A1450" stroke-opacity=".1"/>
        <circle cx="44" cy="36" r="15" fill="#fff" stroke="#0A1450" stroke-opacity=".18"/><circle cx="44" cy="36" r="10" fill="#0A1450"/><rect x="42.5" y="26" width="3" height="8" rx="1.5" fill="#FF6A13"/>
        <rect x="76" y="22" width="78" height="28" rx="9" fill="#0A1450"/><rect x="86" y="33" width="38" height="6" rx="3" fill="#FFC933"/>
        ${dry
            ? '<path d="M170 26c5 4 5 8 0 12s-5 8 0 12M188 26c5 4 5 8 0 12s-5 8 0 12" fill="none" stroke="#FF6A13" stroke-width="3.2" stroke-linecap="round"/>'
            : '<circle cx="172" cy="36" r="7" fill="#FF6A13"/><circle cx="192" cy="36" r="7" fill="#fff" stroke="#0A1450" stroke-opacity=".2"/>'}
        <circle cx="110" cy="168" r="74" fill="url(#gRim)" stroke="#0A1450" stroke-opacity=".16"/>
        <circle cx="110" cy="168" r="64" fill="#EEF2FB" stroke="#0A1450" stroke-opacity=".1"/>
        <circle cx="110" cy="168" r="58" fill="url(#gGlass)"/>
        <g clip-path="url(#ac${u})">
            <g class="a-wave"><path d="${wave(172)}" fill="url(#gWater)"/></g>
            <g class="a-spin" style="transform-origin:110px 168px">
                <circle cx="110" cy="168" r="42" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="4" stroke-linecap="round" stroke-dasharray="0.1 21.9"/>
                <rect x="86" y="140" width="26" height="16" rx="8" fill="#FF8A3D" transform="rotate(-20 99 148)"/>
                <rect x="112" y="172" width="28" height="17" rx="8" fill="#FFC933" transform="rotate(25 126 180)"/>
                <rect x="78" y="176" width="22" height="14" rx="7" fill="#fff" opacity=".92" transform="rotate(10 89 183)"/>
            </g>
        </g>
        <path d="M66 150a50 50 0 0 1 40-38" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>
        ${feet(278, 30, 164)}`;
    };

    const washerTop = () => {
        const u = ++uid;
        return `
        <clipPath id="ac${u}"><rect x="40" y="100" width="140" height="52" rx="26"/></clipPath>
        <ellipse cx="110" cy="283" rx="88" ry="6" fill="#0A1450" opacity=".14"/>
        <rect x="16" y="66" width="188" height="212" rx="20" fill="url(#gBody)" stroke="#0A1450" stroke-opacity=".12"/>
        <rect x="10" y="8" width="200" height="66" rx="16" fill="url(#gPanel)" stroke="#0A1450" stroke-opacity=".12"/>
        <circle cx="46" cy="41" r="15" fill="#fff" stroke="#0A1450" stroke-opacity=".18"/><circle cx="46" cy="41" r="10" fill="#0A1450"/><rect x="44.5" y="31" width="3" height="8" rx="1.5" fill="#FF6A13"/>
        <rect x="80" y="26" width="64" height="30" rx="9" fill="#0A1450"/><rect x="90" y="38" width="30" height="6" rx="3" fill="#FFC933"/>
        <circle cx="168" cy="41" r="7" fill="#FF6A13"/><circle cx="190" cy="41" r="7" fill="#fff" stroke="#0A1450" stroke-opacity=".2"/>
        <rect x="30" y="92" width="160" height="68" rx="22" fill="url(#gRim)" stroke="#0A1450" stroke-opacity=".16"/>
        <rect x="40" y="100" width="140" height="52" rx="26" fill="url(#gGlass)"/>
        <g clip-path="url(#ac${u})">
            <g class="a-wave"><path d="${wave(126)}" fill="url(#gWater)"/></g>
            <g class="a-agit">
                <rect x="82" y="110" width="30" height="16" rx="8" fill="#FF8A3D" transform="rotate(-14 97 118)"/>
                <rect x="114" y="124" width="30" height="16" rx="8" fill="#FFC933" transform="rotate(12 129 132)"/>
                <circle cx="104" cy="134" r="8" fill="#fff" opacity=".9"/>
            </g>
        </g>
        <path d="M54 118a30 20 0 0 1 24-12" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>
        <rect x="40" y="188" width="140" height="10" rx="5" fill="#0A1450" opacity=".08"/>
        <rect x="40" y="210" width="64" height="9" rx="4.5" fill="url(#gOrange)"/>
        ${feet(278, 30, 164)}`;
    };

    const fridgeTop = () => `
        <ellipse cx="100" cy="293" rx="78" ry="6" fill="#0A1450" opacity=".14"/>
        <rect x="22" y="6" width="156" height="282" rx="20" fill="url(#gBody)" stroke="#0A1450" stroke-opacity=".12"/>
        <rect x="32" y="16" width="136" height="82" rx="12" fill="url(#gDoor)" stroke="#0A1450" stroke-opacity=".14"/>
        <rect x="32" y="106" width="136" height="172" rx="12" fill="url(#gDoor)" stroke="#0A1450" stroke-opacity=".14"/>
        <rect x="42" y="62" width="6" height="26" rx="3" fill="#9FB0D6"/><rect x="42" y="118" width="6" height="56" rx="3" fill="#9FB0D6"/>
        <path d="M62 34h40M62 126h30" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>
        <rect x="122" y="122" width="36" height="16" rx="8" fill="#0A1450"/><circle cx="134" cy="130" r="3" fill="#4FC38A" class="a-blink"/>
        <g class="a-snow" style="transform-origin:140px 50px" stroke="#2F6BFF" stroke-width="3" stroke-linecap="round"><path d="M140 36v28M128 43l24 14M128 57l24-14"/></g>
        ${feet(288, 38, 136)}`;

    const fridgeSbs = () => `
        <ellipse cx="110" cy="293" rx="90" ry="6" fill="#0A1450" opacity=".14"/>
        <rect x="14" y="6" width="192" height="282" rx="22" fill="url(#gBody)" stroke="#0A1450" stroke-opacity=".12"/>
        <rect x="24" y="16" width="82" height="262" rx="12" fill="url(#gDoor)" stroke="#0A1450" stroke-opacity=".14"/>
        <rect x="114" y="16" width="82" height="262" rx="12" fill="url(#gDoor)" stroke="#0A1450" stroke-opacity=".14"/>
        <rect x="38" y="64" width="54" height="92" rx="12" fill="#0A1450"/>
        <rect x="48" y="74" width="34" height="12" rx="6" fill="#2F6BFF"/>
        <path class="a-drip" d="M65 108v20" stroke="#7FB0FF" stroke-width="4" stroke-linecap="round"/>
        <rect x="96" y="104" width="6" height="74" rx="3" fill="#9FB0D6"/><rect x="118" y="104" width="6" height="74" rx="3" fill="#9FB0D6"/>
        <path d="M138 40h34M138 200h20" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>
        ${feet(288, 40, 154)}`;

    const minibar = () => `
        <ellipse cx="100" cy="233" rx="66" ry="5" fill="#0A1450" opacity=".14"/>
        <rect x="34" y="14" width="132" height="212" rx="18" fill="url(#gBody)" stroke="#0A1450" stroke-opacity=".12"/>
        <rect x="42" y="22" width="116" height="48" rx="11" fill="url(#gDoor)" stroke="#0A1450" stroke-opacity=".14"/>
        <rect x="42" y="78" width="116" height="140" rx="11" fill="url(#gDoor)" stroke="#0A1450" stroke-opacity=".14"/>
        <rect x="50" y="36" width="6" height="20" rx="3" fill="#9FB0D6"/><rect x="50" y="94" width="6" height="42" rx="3" fill="#9FB0D6"/>
        <path d="M72 38h34M72 96h24" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>
        <circle cx="140" cy="46" r="4.5" fill="#4FC38A" class="a-blink"/>
        <rect x="52" y="226" width="22" height="5" rx="2.5" fill="#0A1450" opacity=".45"/><rect x="126" y="226" width="22" height="5" rx="2.5" fill="#0A1450" opacity=".45"/>`;

    const tagPill = (w, label, fill, color, cls = '') =>
        `<g class="a-bob ${cls}"><rect width="${w}" height="42" rx="21" fill="${fill}"/><text x="${w / 2}" y="27" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="14" font-weight="700" fill="${color}">${label}</text></g>`;

    // llave: la cabeza (con la tuerca amarilla) queda en el origen y el mango sale hacia la derecha
    const wrench = () => `
        <rect x="8" y="-5.5" width="38" height="11" rx="5.5" fill="#0A1450"/>
        <rect x="18" y="-2.4" width="20" height="2.6" rx="1.3" fill="#fff" opacity=".28"/>
        <circle r="14" fill="#0A1450"/>
        <polygon points="7.5,0 3.75,6.5 -3.75,6.5 -7.5,0 -3.75,-6.5 3.75,-6.5" fill="#FFC933"/>`;

    // técnico de caricatura: pies en el origen, mira a la izquierda. El brazo izquierdo sostiene la llave
    // (agarra el mango a 32px de la cabeza de la llave) y va al mismo ritmo que ella: ver tech-* en styles.css
    const technician = () => `
        <ellipse rx="46" ry="6" fill="#0A1450" opacity=".14"/>
        <rect x="-30" y="-130" width="60" height="64" rx="18" fill="#1F4FD8" stroke="#0A1450" stroke-width="3"/>
        <rect x="-16" y="-110" width="16" height="16" rx="4" fill="#FFC933" stroke="#0A1450" stroke-width="2.5"/>
        <rect x="-22" y="-74" width="20" height="66" rx="8" fill="#0A1450"/><rect x="2" y="-74" width="20" height="66" rx="8" fill="#0A1450"/>
        <rect x="-36" y="-14" width="32" height="14" rx="7" fill="#FF6A13" stroke="#0A1450" stroke-width="3"/><rect x="-2" y="-14" width="32" height="14" rx="7" fill="#FF6A13" stroke="#0A1450" stroke-width="3"/>
        <path d="M24 -112L44 -94L26 -82" stroke="#0A1450" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M24 -112L44 -94L26 -82" stroke="#1F4FD8" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="26" cy="-80" r="8" fill="#FFD0A6" stroke="#0A1450" stroke-width="3"/>
        <g class="a-nod" style="transform-origin:0 -128px">
            <circle cx="-25" cy="-150" r="5.5" fill="#FFD0A6" stroke="#0A1450" stroke-width="3"/><circle cx="25" cy="-150" r="5.5" fill="#FFD0A6" stroke="#0A1450" stroke-width="3"/>
            <circle cy="-152" r="25" fill="#FFD0A6" stroke="#0A1450" stroke-width="3"/>
            <circle class="a-eye" cx="-11" cy="-142" r="3.2" fill="#0A1450"/><circle class="a-eye" cx="7" cy="-142" r="3.2" fill="#0A1450"/>
            <circle cx="-17" cy="-136" r="4" fill="#FF6A13" opacity=".3"/><circle cx="14" cy="-136" r="4" fill="#FF6A13" opacity=".3"/>
            <path d="M-8 -135q7 8 14 0" stroke="#0A1450" stroke-width="3" stroke-linecap="round"/>
            <path d="M-27 -158a27 25 0 0 1 54 0z" fill="#FFC933" stroke="#0A1450" stroke-width="3" stroke-linejoin="round"/>
            <rect x="-4.5" y="-181.5" width="9" height="23.5" rx="3" fill="#FF6A13"/>
            <rect x="-31" y="-163" width="62" height="9" rx="4.5" fill="#FF6A13" stroke="#0A1450" stroke-width="3"/>
        </g>
        <g transform="translate(-26 -112)"><g class="a-arm">
            <path d="M0 0H-40" stroke="#0A1450" stroke-width="19" stroke-linecap="round"/>
            <path d="M0 0H-40" stroke="#1F4FD8" stroke-width="13" stroke-linecap="round"/>
            <circle cx="-41" r="8.5" fill="#FFD0A6" stroke="#0A1450" stroke-width="3"/>
        </g></g>`;

    const toolbox = () => `
        <path d="M11 0v-5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v5" stroke="#0A1450" stroke-width="3"/>
        <rect width="38" height="22" rx="5" fill="#FF6A13" stroke="#0A1450" stroke-width="3"/>
        <rect x="15" y="6" width="8" height="8" rx="2" fill="#FFC933" stroke="#0A1450" stroke-width="2"/>`;

    const spark = (x, y, s, d) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="a-twinkle" style="animation-delay:${d}s" d="M0-14C1-5 5-1 14 0 5 1 1 5 0 14-1 5-5 1-14 0-5-1-1-5 0-14Z" fill="#FFC933" stroke="#0A1450" stroke-width="2" stroke-linejoin="round"/></g>`;

    const ART = {
        'washer-front': () => svg('0 0 220 290', washerFront()),
        'washer-dryer': () => svg('0 0 220 290', washerFront(true)),
        'washer-top': () => svg('0 0 220 290', washerTop()),
        'fridge-top': () => svg('0 0 200 300', fridgeTop()),
        'fridge-sbs': () => svg('0 0 220 300', fridgeSbs()),
        'minibar': () => svg('0 0 200 240', minibar()),

        'svc-compra': () => svg('0 0 400 260', `
            <circle cx="200" cy="132" r="112" fill="#fff" opacity=".75"/>
            <circle cx="200" cy="132" r="82" fill="#FFE2CC" opacity=".8"/>
            <g transform="translate(118 12) scale(.82)">${washerTop()}</g>
            <g transform="translate(262 52) rotate(10)">${tagPill(126, 'SE COMPRA', 'url(#gOrange)', '#0A1450')}</g>
            <g transform="translate(70 100)"><g class="a-bob a-bob--2"><circle r="29" fill="#FFC933" stroke="#0A1450" stroke-width="3"/><text y="11" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-size="32" font-weight="800" fill="#0A1450">$</text></g></g>`),

        'svc-venta': () => svg('0 0 400 260', `
            <circle cx="200" cy="132" r="112" fill="#fff" opacity=".75"/>
            <circle cx="200" cy="132" r="82" fill="#CFDDFF" opacity=".8"/>
            <g transform="translate(130 6) scale(.84)">${fridgeSbs()}</g>
            <g transform="translate(34 62) rotate(-9)">${tagPill(104, 'NUEVO', 'url(#gBlue)', '#FFFFFF')}</g>
            <g transform="translate(270 132) rotate(8)">${tagPill(104, 'USADO', 'url(#gOrange)', '#0A1450', 'a-bob--2')}</g>`),

        'svc-refac': () => svg('0 0 400 260', `
            <circle cx="200" cy="130" r="112" fill="#fff" opacity=".75"/>
            <g transform="translate(190 124)"><g class="a-rot"><use href="#i-gear" x="-84" y="-84" width="168" height="168" style="color:#FF6A13"/></g></g>
            <g transform="translate(290 188)"><g class="a-rot-rev"><use href="#i-gear" x="-46" y="-46" width="92" height="92" style="color:#0A1450"/></g></g>
            <g transform="translate(96 196)"><g class="a-bob"><polygon points="0,-26 22.5,-13 22.5,13 0,26 -22.5,13 -22.5,-13" fill="#9FB0D6" stroke="#0A1450" stroke-width="3" stroke-linejoin="round"/><circle r="9" fill="#fff" stroke="#0A1450" stroke-width="3"/></g></g>
            <g transform="translate(78 74)"><g class="a-bob a-bob--2"><path d="M0-34l-16 9 32 11-32 11 32 11-32 11 16 9" fill="none" stroke="#FF6A13" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g></g>`),

        'svc-repar': () => svg('0 0 400 260', `
            <circle cx="200" cy="132" r="112" fill="#fff" opacity=".78"/>
            <g transform="translate(78 14) scale(.8)">${washerFront()}</g>
            <g transform="translate(252 218)">${toolbox()}</g>
            <g transform="translate(232 128)"><g class="a-wrench">${wrench()}</g></g>
            <g transform="translate(330 240)">${technician()}</g>
            ${spark(262, 52, 1, 0)}${spark(378, 58, .7, .6)}${spark(250, 100, .7, 1.1)}`),
    };

    function initArt() {
        $$('[data-art]').forEach(el => {
            const make = ART[el.dataset.art];
            if (make) el.innerHTML = make();
        });
    }

    /* ───────────── 9. HERO ───────────── */
    const heroPointer = { x: -999, y: -999 };

    function initHero() {
        const hero = $('#inicio');
        const stage = $('#stage');
        if (!hero || !stage) return;

        let visible = true;
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(hero);
        }

        // parallax por puntero: cada capa se mueve según su profundidad
        if (finePointer && !reduce) {
            const layers = $$('[data-depth]', stage);
            let raf = 0, nx = 0, ny = 0;
            const apply = () => {
                raf = 0;
                layers.forEach(l => {
                    const d = parseFloat(l.dataset.depth) * .6;
                    l.style.setProperty('--px', (nx * d).toFixed(1) + 'px');
                    l.style.setProperty('--py', (ny * d).toFixed(1) + 'px');
                });
            };
            hero.addEventListener('pointermove', e => {
                const r = hero.getBoundingClientRect();
                nx = (e.clientX - r.left) / r.width - .5;
                ny = (e.clientY - r.top) / r.height - .5;
                heroPointer.x = e.clientX - r.left;
                heroPointer.y = e.clientY - r.top;
                if (!raf) raf = requestAnimationFrame(apply);
            }, { passive: true });
            hero.addEventListener('pointerleave', () => {
                nx = ny = 0; heroPointer.x = heroPointer.y = -999;
                if (!raf) raf = requestAnimationFrame(apply);
            });
        }

        // el hero se desplaza y se atenúa suavemente al bajar
        const copy = $('.hero__copy', hero);
        if (!reduce) {
            track(hero, y => {
                const t = clamp(y / (engine.vh * .9));
                stage.style.transform = `translate3d(0, ${(-y * .06).toFixed(1)}px, 0)`;
                if (copy) { copy.style.transform = `translate3d(0, ${(y * .1).toFixed(1)}px, 0)`; copy.style.opacity = (1 - t * .9).toFixed(3); }
                return false;
            });
        }

        // el visor de la lavadora cuenta el ciclo y el refrigerador marca su temperatura
        const timeEl = $('#w-time');
        const tempEl = $('#f-temp');
        if (!reduce) {
            let secs = 45, flip = 0;
            setInterval(() => {
                if (!visible || document.hidden) return;
                secs = secs <= 0 ? 45 : secs - 1;
                if (timeEl) timeEl.textContent = '00:' + String(secs).padStart(2, '0');
                if (tempEl && ++flip % 4 === 0) tempEl.textContent = tempEl.textContent.startsWith('4') ? '3°C' : '4°C';
            }, 1000);
        }

        initHeroCanvas(hero, () => visible);
    }

    // burbujas suaves que suben y se apartan del cursor
    function initHeroCanvas(hero, isVisible) {
        const cv = $('#hero-canvas');
        if (!cv || reduce) return;
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        const COLORS = ['47,107,255', '255,138,61', '255,201,51', '31,79,216'];
        let w = 0, h = 0, bubbles = [];

        const make = initial => ({
            x: Math.random() * w,
            y: initial ? Math.random() * h : h + 30,
            r: 3 + Math.pow(Math.random(), 2) * 17,
            vy: .18 + Math.random() * .55,
            ph: Math.random() * TAU,
            sp: .0004 + Math.random() * .0009,
            a: .14 + Math.random() * .22,
            c: COLORS[(Math.random() * COLORS.length) | 0],
        });

        const resize = () => {
            const r = cv.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = r.width; h = r.height;
            cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = clamp(Math.round(w / 30), 16, 44);
            bubbles = Array.from({ length: n }, () => make(true));
        };
        resize();
        window.addEventListener('resize', resize, { passive: true });

        engine.anims.push(now => {
            if (!isVisible() || document.hidden || !root.classList.contains('is-ready')) return;
            ctx.clearRect(0, 0, w, h);
            for (const b of bubbles) {
                b.y -= b.vy;
                b.x += Math.sin(now * b.sp + b.ph) * .35;
                const dx = b.x - heroPointer.x, dy = b.y - heroPointer.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < 130 * 130) { const d = Math.sqrt(d2) || 1; const f = (130 - d) / 130 * 2.4; b.x += dx / d * f; b.y += dy / d * f; }
                if (b.y < -30) Object.assign(b, make(false));
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, 0, TAU);
                ctx.fillStyle = `rgba(${b.c},${(b.a * .45).toFixed(3)})`;
                ctx.fill();
                ctx.lineWidth = 1.2;
                ctx.strokeStyle = `rgba(${b.c},${(b.a + .2).toFixed(3)})`;
                ctx.stroke();
                if (b.r > 6) {
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.r * .68, Math.PI * 1.15, Math.PI * 1.55);
                    ctx.strokeStyle = 'rgba(255,255,255,.85)';
                    ctx.lineWidth = 1.6;
                    ctx.stroke();
                }
            }
        });
    }

    /* ───────────── 10. DIAGNÓSTICO RÁPIDO ───────────── */
    const DIAG = {
        lavadora: [
            { label: 'No centrifuga', msg: 'no centrifuga', title: 'No exprime la ropa', cause: 'Suele ser una carga desbalanceada, la bomba de desagüe tapada o el sensor de la tapa. Si persiste, puede ser el motor o la tarjeta.', check: 'Filtro y manguera de desagüe, sensor de tapa y carbones del motor.' },
            { label: 'No desagua', msg: 'no desagua', title: 'El agua no sale', cause: 'Lo más común es el filtro de la bomba obstruido (pelusa, monedas, calcetines) o la bomba dañada.', check: 'Filtro de la bomba, manguera de desagüe y la bomba.' },
            { label: 'Hace mucho ruido', msg: 'hace mucho ruido', title: 'Ruido o vibración fuerte', cause: 'Puede ser un objeto atorado, amortiguadores vencidos o rodamientos del tambor desgastados.', check: 'Amortiguadores, rodamientos del tambor y soportes.' },
            { label: 'Tira agua', msg: 'tira agua', title: 'Fuga de agua', cause: 'Normalmente es una manguera floja, el empaque de la puerta o un sello de la bomba.', check: 'Mangueras, empaque de la puerta y sello de la bomba.' },
            { label: 'No enciende', msg: 'no enciende', title: 'Sin energía', cause: 'Puede ser el cable o la clavija, el interruptor de la tapa o la tarjeta electrónica.', check: 'Cable de alimentación, interruptor de tapa y tarjeta.' },
            { label: 'No llena de agua', msg: 'no llena de agua', title: 'No entra agua', cause: 'Casi siempre es la válvula de entrada tapada o una falla en el sensor de nivel.', check: 'Válvula de entrada, filtro de la manguera y presostato.' },
        ],
        refrigerador: [
            { label: 'No enfría', msg: 'no enfría', title: 'Falla de enfriamiento', cause: 'Puede ser el ventilador del evaporador, el termostato, el relé del compresor o la tarjeta.', check: 'Ventilador, termostato, relé y compresor.' },
            { label: 'Hace ruido', msg: 'hace ruido', title: 'Ruido en el refrigerador', cause: 'Suele ser el ventilador del evaporador o del condensador. Un compresor forzado también suena más.', check: 'Ventiladores, compresor y soportes.' },
            { label: 'Mucha escarcha', msg: 'hace mucha escarcha', title: 'Exceso de hielo o escarcha', cause: 'Puede ser la resistencia de deshielo, un sensor de temperatura o un empaque de puerta que no sella.', check: 'Resistencia de deshielo, sensor y empaques.' },
            { label: 'Gotea agua', msg: 'gotea agua', title: 'Agua dentro o debajo', cause: 'Casi siempre es el desagüe del deshielo tapado o la charola desbordada.', check: 'Desagüe, charola y manguera de deshielo.' },
            { label: 'Congela todo', msg: 'congela todo', title: 'Enfría de más', cause: 'Normalmente es el termostato o el sensor de temperatura descalibrado.', check: 'Termostato y sensor de temperatura.' },
            { label: 'Se apaga solo', msg: 'se apaga solo o no enciende', title: 'Se apaga o no enciende', cause: 'Puede ser el relé, el protector térmico del compresor o la tarjeta electrónica.', check: 'Relé, protector térmico y tarjeta.' },
        ],
    };

    function initDiagnostic() {
        const card = $('#diag');
        if (!card) return;
        const choices = $$('.choice', card);
        const symBlock = $('#diag-sym');
        const chips = $('#diag-chips');
        const scan = $('#diag-scan');
        const result = $('#diag-result');
        let equipo = null;
        let timer = 0;

        const clearOutput = () => { clearTimeout(timer); scan.hidden = true; result.hidden = true; };

        choices.forEach(btn => btn.addEventListener('click', () => {
            equipo = btn.dataset.equipo;
            choices.forEach(b => b.setAttribute('aria-checked', String(b === btn)));
            clearOutput();
            chips.innerHTML = DIAG[equipo].map((s, i) =>
                `<button type="button" class="chip-btn" role="radio" aria-checked="false" data-i="${i}" style="--k:${i}">${s.label}</button>`).join('');
            symBlock.hidden = false;
        }));

        chips.addEventListener('click', e => {
            const btn = e.target.closest('.chip-btn');
            if (!btn || !equipo) return;
            $$('.chip-btn', chips).forEach(b => b.setAttribute('aria-checked', String(b === btn)));
            const s = DIAG[equipo][Number(btn.dataset.i)];
            clearOutput();
            scan.hidden = false;
            timer = setTimeout(() => {
                scan.hidden = true;
                $('#res-title').textContent = s.title;
                $('#res-cause').textContent = s.cause;
                $('#res-check').textContent = s.check;
                $('#res-cta').href = waURL(`Hola Rob Zam, mi ${equipo} ${s.msg}. Quiero que lo revisen.`);
                result.hidden = false;
                if (result.getBoundingClientRect().bottom > window.innerHeight) {
                    result.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
                }
            }, reduce ? 0 : 950);
        });

        $('#diag-reset').addEventListener('click', () => {
            equipo = null;
            clearOutput();
            symBlock.hidden = true;
            chips.innerHTML = '';
            choices.forEach(b => b.setAttribute('aria-checked', 'false'));
            choices[0].focus();
        });
    }

    // navegación con flechas dentro de cualquier radiogroup (accesibilidad de teclado)
    function initRadioKeys() {
        document.addEventListener('keydown', e => {
            if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
            const group = e.target.closest && e.target.closest('[role="radiogroup"]');
            if (!group) return;
            const items = $$('[role="radio"]', group);
            const i = items.indexOf(e.target);
            if (i < 0) return;
            e.preventDefault();
            const next = items[(i + (/Right|Down/.test(e.key) ? 1 : -1) + items.length) % items.length];
            next.focus();
            next.click();
        });
    }

    /* ───────────── 11. CATÁLOGO ───────────── */
    function initCatalog() {
        const viewport = $('.cat__viewport');
        const track = $('#cat-track');
        if (!viewport || !track) return;
        const cards = $$('.ccard', track);
        const prev = $('#cat-prev');
        const next = $('#cat-next');
        const COND_LABEL = { ambos: 'Nuevo y usado', nuevo: 'Nuevo', usado: 'Usado' };
        const COND_MSG = { ambos: 'nuevo o usado', nuevo: 'nuevo', usado: 'usado' };
        let type = 'todos';
        let cond = 'ambos';

        const updateArrows = () => {
            prev.disabled = viewport.scrollLeft < 4;
            next.disabled = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 4;
        };

        const render = () => {
            let k = 0;
            cards.forEach(c => {
                const show = type === 'todos' || c.dataset.type === type;
                c.classList.toggle('is-hidden', !show);
                $('.ccard__cond', c).textContent = COND_LABEL[cond];
                $('a.btn', c).href = waURL(`Hola Rob Zam, me interesa: ${c.dataset.name} (${COND_MSG[cond]}). ¿Tienen disponibilidad y precio?`);
                if (show) {
                    c.style.setProperty('--k', k++);
                    c.classList.remove('is-in');
                    void c.offsetWidth; // reinicia la animación de entrada
                    c.classList.add('is-in');
                }
            });
            viewport.scrollTo({ left: 0, behavior: 'auto' });
            updateArrows();
        };

        const bindSegment = (id, key, apply) => {
            const seg = $(id);
            if (!seg) return;
            seg.addEventListener('click', e => {
                const btn = e.target.closest('.seg__btn');
                if (!btn) return;
                $$('.seg__btn', seg).forEach(b => { const on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
                apply(btn.dataset[key]);
                render();
            });
        };
        bindSegment('#cat-type', 'type', v => { type = v; });
        bindSegment('#cat-cond', 'cond', v => { cond = v; });

        const step = () => (cards.find(c => !c.classList.contains('is-hidden')) || cards[0]).offsetWidth + 16;
        prev.addEventListener('click', () => viewport.scrollBy({ left: -step(), behavior: 'smooth' }));
        next.addEventListener('click', () => viewport.scrollBy({ left: step(), behavior: 'smooth' }));
        viewport.addEventListener('scroll', updateArrows, { passive: true });
        window.addEventListener('resize', updateArrows, { passive: true });

        // arrastrar con el mouse (en pantallas táctiles ya funciona el scroll nativo)
        let down = false, moved = false, startX = 0, startLeft = 0;
        viewport.addEventListener('pointerdown', e => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            down = true; moved = false; startX = e.clientX; startLeft = viewport.scrollLeft;
        });
        window.addEventListener('pointermove', e => {
            if (!down) return;
            const dx = e.clientX - startX;
            if (!moved && Math.abs(dx) > 6) { moved = true; viewport.classList.add('is-drag'); }
            if (moved) viewport.scrollLeft = startLeft - dx;
        });
        const end = () => { if (!down) return; down = false; viewport.classList.remove('is-drag'); };
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);

        render();
    }

    /* ───────────── 12. FAQ, FORMULARIO Y MICRO-INTERACCIONES ───────────── */
    function initFaq() {
        const list = $('#faq-list');
        if (!list) return;
        const setOpen = (q, open) => {
            q.setAttribute('aria-expanded', String(open));
            q.closest('.qa').classList.toggle('is-open', open);
        };
        list.addEventListener('click', e => {
            const q = e.target.closest('.qa__q');
            if (q) setOpen(q, q.getAttribute('aria-expanded') !== 'true');
        });
        const first = $('.qa__q', list);
        if (first) setOpen(first, true);
    }

    function initForm() {
        const form = $('#form');
        if (!form) return;
        const note = $('#form-note');
        const submit = $('#form-submit');
        const label = $('span', submit);
        const originalLabel = label.textContent;
        const originalNote = note.textContent;
        let attempted = false;

        const rules = {
            nombre: v => (v.trim().length >= 2 ? '' : 'Escribe tu nombre para saber cómo llamarte.'),
            equipo: v => (v ? '' : 'Elige el equipo.'),
            necesito: v => (v ? '' : 'Cuéntanos qué necesitas.'),
        };
        const show = (name, msg) => {
            const field = form.elements[name];
            field.closest('.field').classList.toggle('is-invalid', Boolean(msg));
            $('#e-' + name).textContent = msg;
            field.setAttribute('aria-invalid', msg ? 'true' : 'false');
            if (msg) field.setAttribute('aria-describedby', 'e-' + name); else field.removeAttribute('aria-describedby');
        };
        const check = name => { const msg = rules[name](form.elements[name].value); show(name, msg); return msg; };

        Object.keys(rules).forEach(name => {
            const f = form.elements[name];
            f.addEventListener('input', () => { if (attempted) check(name); });
            f.addEventListener('change', () => { if (attempted) check(name); });
        });

        form.addEventListener('submit', e => {
            e.preventDefault();
            attempted = true;
            let firstBad = null;
            Object.keys(rules).forEach(name => { if (check(name) && !firstBad) firstBad = form.elements[name]; });
            if (firstBad) { firstBad.focus(); return; }

            const d = Object.fromEntries(new FormData(form));
            const lines = [`Hola Rob Zam, soy ${d.nombre.trim()}.`, `Equipo: ${d.equipo}`, `Necesito: ${d.necesito}`];
            if (d.modelo.trim()) lines.push(`Marca y modelo: ${d.modelo.trim()}`);
            if (d.mensaje.trim()) lines.push(`Detalle: ${d.mensaje.trim()}`);
            const url = waURL(lines.join('\n'));

            const win = window.open(url, '_blank');
            if (win) win.opener = null; else window.location.href = url;

            form.classList.add('is-sent');
            label.textContent = '¡Listo! Abriendo WhatsApp';
            note.textContent = 'Si no se abrió, toca el botón de WhatsApp de la esquina o escríbenos al 55 4019 9540.';
            setTimeout(() => {
                form.classList.remove('is-sent');
                label.textContent = originalLabel;
                note.textContent = originalNote;
            }, 6000);
        });
    }

    function initCounters() {
        const els = $$('[data-count]');
        if (!els.length || reduce || !('IntersectionObserver' in window)) return;
        const run = el => {
            const target = Number(el.dataset.count);
            const t0 = performance.now();
            const dur = 1500;
            const step = now => {
                const t = clamp((now - t0) / dur);
                el.textContent = Math.round(easeOut(t) * target);
                if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
        }, { threshold: .6 });
        els.forEach(el => { el.textContent = '0'; io.observe(el); });
    }

    function initMicro() {
        // onda al tocar cualquier botón
        document.addEventListener('pointerdown', e => {
            const btn = e.target.closest && e.target.closest('.btn');
            if (!btn || reduce) return;
            const r = btn.getBoundingClientRect();
            const size = Math.max(r.width, r.height);
            const dot = document.createElement('span');
            dot.className = 'ripple';
            dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
            btn.appendChild(dot);
            setTimeout(() => dot.remove(), 750);
        }, { passive: true });

        if (!finePointer || reduce) return;

        // botones magnéticos
        $$('.magnetic').forEach(el => {
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                const x = e.clientX - (r.left + r.width / 2);
                const y = e.clientY - (r.top + r.height / 2);
                el.style.translate = `${clamp(x * .18, -10, 10).toFixed(1)}px ${clamp(y * .28, -8, 8).toFixed(1)}px`;
            });
            el.addEventListener('pointerleave', () => { el.style.translate = ''; });
        });

        // foco de luz que sigue al cursor en el bento
        $$('.spot').forEach(el => {
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
                el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
            }, { passive: true });
        });

        // inclinación 3D de la lona en el contacto
        const tilt = $('#tilt');
        if (tilt) {
            tilt.addEventListener('pointermove', e => {
                const r = tilt.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width - .5;
                const y = (e.clientY - r.top) / r.height - .5;
                tilt.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
                tilt.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
            });
            tilt.addEventListener('pointerleave', () => { tilt.style.setProperty('--rx', '0deg'); tilt.style.setProperty('--ry', '0deg'); });
        }
    }

    /* ───────────── 13. ARRANQUE ───────────── */
    function onReveal() {
        root.classList.add('is-ready');
        const title = $('[data-hero-split]');
        if (title) title.classList.add('is-in');
        const nav = $('#nav');
        if (nav) nav.classList.add('is-in');
        const wa = $('#wa-float');
        if (wa) {
            setTimeout(() => wa.classList.add('is-in'), 900);
            setTimeout(() => wa.classList.add('is-tip'), 6500);
            setTimeout(() => wa.classList.remove('is-tip'), 13000);
        }
        engine.dirty = true;
    }

    function init() {
        const year = $('#year');
        if (year) year.textContent = new Date().getFullYear();

        // cada módulo es independiente: si uno falla, el resto del sitio (y el loader) sigue funcionando
        [
            initWhatsAppLinks, initArt, initReveal, initNav, initMarquee, initStack, initLona,
            initAnatomy, initProcess, initHero, initDiagnostic, initRadioKeys, initCatalog,
            initFaq, initForm, initCounters, initMicro,
        ].forEach(fn => {
            try { fn(); } catch (err) { console.error(`[Rob Zam] ${fn.name} falló:`, err); }
        });

        window.addEventListener('resize', onResize, { passive: true });
        requestAnimationFrame(frame);
        runLoader(onReveal);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
