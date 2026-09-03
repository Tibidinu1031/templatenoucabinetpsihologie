/* ==========================================================================
   Meridian — application layer
   Vanilla JS, no dependencies. Every module is opt-in via data attributes,
   so a page only pays for what it actually uses.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raf = (fn) => window.requestAnimationFrame(fn);

  /* Contact details are injected by the build (window.EP). The fallbacks only
     matter if a page is opened without that inline config. */
  const EP = Object.assign({
    person: '', phone: '', phoneRaw: '', wa: '', email: '', address: ''
  }, window.EP || {});

  const waUrl = (text) => `https://wa.me/${EP.wa}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

  /* Until an email address exists, every hand-off goes through WhatsApp. */
  const handOff = (subject, body) => {
    if (EP.email) {
      window.location.href = `mailto:${EP.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      return 'email';
    }
    window.open(waUrl(`${subject}\n\n${body}`), '_blank', 'noopener');
    return 'whatsapp';
  };

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */
  const Theme = {
    key: 'ep-theme',
    init() {
      $$('[data-theme-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => this.toggle(btn));
        this.sync(btn);
      });
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (!localStorage.getItem(this.key)) $$('[data-theme-toggle]').forEach((b) => this.sync(b));
      });
    },
    current() {
      return document.documentElement.dataset.theme ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    },
    toggle(btn) {
      const next = this.current() === 'dark' ? 'light' : 'dark';
      const apply = () => {
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem(this.key, next); } catch (e) { /* private mode */ }
        $$('[data-theme-toggle]').forEach((b) => this.sync(b));
      };
      if (document.startViewTransition && !prefersReduced()) document.startViewTransition(apply);
      else apply();
      if (btn) Toast.show(next === 'dark' ? 'Temă întunecată activată' : 'Temă luminoasă activată');
    },
    sync(btn) {
      const dark = this.current() === 'dark';
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', dark ? 'Comută pe tema luminoasă' : 'Comută pe tema întunecată');
      const sun = $('[data-icon="sun"]', btn);
      const moon = $('[data-icon="moon"]', btn);
      if (sun && moon) { sun.hidden = !dark; moon.hidden = dark; }
    }
  };

  /* ------------------------------------------------------------------ *
   * Header: stuck state + scroll progress + back-to-top
   * ------------------------------------------------------------------ */
  const Chrome = {
    init() {
      const header = $('[data-header]');
      const bar = $('[data-progress]');
      const fab = $('[data-to-top]');
      const dock = $('[data-mobile-bar]');
      if (!header && !bar && !fab && !dock) return;

      let ticking = false;
      let lastY = window.scrollY;
      const update = () => {
        const y = window.scrollY;
        if (header) header.dataset.stuck = String(y > 8);
        if (bar) {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          bar.style.setProperty('--p', max > 0 ? String(Math.min(y / max, 1)) : '0');
        }
        if (fab) fab.dataset.show = String(y > window.innerHeight * 0.8);
        /* The dock steps aside while reading down and returns on the way up,
           so it never competes with the content for the bottom of the screen. */
        if (dock) {
          const delta = y - lastY;
          if (y < 120) dock.dataset.hidden = 'false';
          else if (delta > 6) dock.dataset.hidden = 'true';
          else if (delta < -6) dock.dataset.hidden = 'false';
        }
        lastY = y;
        ticking = false;
      };
      window.addEventListener('scroll', () => {
        if (!ticking) { ticking = true; raf(update); }
      }, { passive: true });
      update();

      if (fab) fab.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' });
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Mobile drawer with focus trap
   * ------------------------------------------------------------------ */
  const Drawer = {
    init() {
      const drawer = $('[data-drawer]');
      const openers = $$('[data-drawer-open]');
      if (!drawer || !openers.length) return;
      const panel = $('.drawer__panel', drawer);
      const scrim = $('.drawer__scrim', drawer);
      let lastFocus = null;

      const setOpen = (open) => {
        drawer.dataset.open = String(open);
        drawer.setAttribute('aria-hidden', String(!open));
        openers.forEach((o) => o.setAttribute('aria-expanded', String(open)));
        document.body.style.overflow = open ? 'hidden' : '';
        if (open) {
          lastFocus = document.activeElement;
          setTimeout(() => { const f = $('a, button', panel); if (f) f.focus(); }, 60);
        } else if (lastFocus) {
          lastFocus.focus();
        }
      };

      openers.forEach((o) => o.addEventListener('click', () => setOpen(drawer.dataset.open !== 'true')));
      if (scrim) scrim.addEventListener('click', () => setOpen(false));
      $$('[data-drawer-close]', drawer).forEach((c) => c.addEventListener('click', () => setOpen(false)));
      $$('a', panel).forEach((a) => a.addEventListener('click', () => setOpen(false)));

      document.addEventListener('keydown', (e) => {
        if (drawer.dataset.open !== 'true') return;
        if (e.key === 'Escape') { setOpen(false); return; }
        if (e.key !== 'Tab') return;
        const items = $$('a[href], button:not([disabled]), summary, input, select, textarea', panel)
          .filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Scroll reveal — staggered, one-shot
   * ------------------------------------------------------------------ */
  const Reveal = {
    init() {
      const items = $$('[data-reveal]');
      if (!items.length) return;
      if (prefersReduced() || !('IntersectionObserver' in window)) {
        items.forEach((el) => { el.dataset.revealed = 'true'; });
        return;
      }
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const group = el.closest('[data-reveal-group]');
          if (group) {
            const sibs = $$('[data-reveal]', group);
            const i = sibs.indexOf(el);
            el.style.setProperty('--reveal-delay', `${Math.min(i, 8) * 70}ms`);
          }
          el.dataset.revealed = 'true';
          io.unobserve(el);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      items.forEach((el) => io.observe(el));

      /* Safety net: content must never stay invisible because an observer
         misfired on an unusual viewport or a throttled tab. */
      setTimeout(() => {
        items.filter((el) => el.dataset.revealed !== 'true' && el.getBoundingClientRect().top < window.innerHeight)
          .forEach((el) => { el.dataset.revealed = 'true'; });
      }, 2500);
    }
  };

  /* ------------------------------------------------------------------ *
   * Pointer-follow glow on cards
   * ------------------------------------------------------------------ */
  const Glow = {
    init() {
      if (window.matchMedia('(hover: none)').matches) return;
      document.addEventListener('pointermove', (e) => {
        const card = e.target.closest('.card');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      }, { passive: true });
    }
  };

  /* ------------------------------------------------------------------ *
   * Animated counters
   * ------------------------------------------------------------------ */
  const Counters = {
    init() {
      const nodes = $$('[data-count]');
      if (!nodes.length) return;
      const settle = (el) => {
        el.dataset.counted = 'true';
        el.textContent = el.dataset.count + (el.dataset.countSuffix || '');
      };
      if (!('IntersectionObserver' in window)) { nodes.forEach(settle); return; }
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          io.unobserve(el);
          if (el.dataset.counted === 'true') return;
          el.dataset.counted = 'true';
          const target = parseFloat(el.dataset.count);
          const suffix = el.dataset.countSuffix || '';
          if (prefersReduced()) { el.textContent = target + suffix; return; }
          const dur = 1300, t0 = performance.now();
          let done = false;
          const tick = (t) => {
            const p = Math.min((t - t0) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (p < 1) raf(tick); else done = true;
          };
          raf(tick);
          /* If frames get throttled the count would freeze on a wrong number,
             so the final value is guaranteed on a timer, not on a frame. */
          setTimeout(() => { if (!done) el.textContent = target + suffix; }, dur + 250);
        });
      }, { threshold: 0.4 });
      nodes.forEach((n) => io.observe(n));

      /* A number stuck at 0 reads as broken. If the observer never delivers
         (throttled tab, bfcache restore), print the real figure anyway. */
      setTimeout(() => {
        nodes.filter((n) => n.dataset.counted !== 'true' && n.getBoundingClientRect().top < window.innerHeight)
          .forEach(settle);
      }, 3000);
    }
  };

  /* ------------------------------------------------------------------ *
   * Segmented control (cabinet / online etc.)
   * ------------------------------------------------------------------ */
  const Segmented = {
    init() {
      $$('[data-segmented]').forEach((root) => {
        const btns = $$('.segmented__btn', root);
        const thumb = $('.segmented__thumb', root);
        const move = () => {
          const active = btns.find((b) => b.getAttribute('aria-selected') === 'true') || btns[0];
          if (!thumb || !active) return;
          thumb.style.width = `${active.offsetWidth}px`;
          thumb.style.transform = `translateX(${active.offsetLeft - 4}px)`;
        };
        btns.forEach((btn) => {
          btn.addEventListener('click', () => {
            btns.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
            move();
            const val = btn.dataset.value;
            root.dispatchEvent(new CustomEvent('segment:change', { detail: { value: val }, bubbles: true }));
            const scope = root.dataset.segmented;
            if (scope) {
              $$(`[data-segment-target="${scope}"]`).forEach((t) => {
                t.hidden = t.dataset.segmentValue !== val;
              });
            }
          });
        });
        raf(move);
        window.addEventListener('resize', move);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(move);
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Toasts
   * ------------------------------------------------------------------ */
  const Toast = {
    wrap: null,
    ensure() {
      if (this.wrap) return this.wrap;
      this.wrap = $('.toast-wrap') || Object.assign(document.createElement('div'), { className: 'toast-wrap' });
      this.wrap.setAttribute('role', 'status');
      this.wrap.setAttribute('aria-live', 'polite');
      if (!this.wrap.isConnected) document.body.appendChild(this.wrap);
      return this.wrap;
    },
    show(message, ms = 3200) {
      const wrap = this.ensure();
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 8 14.5 16 6"/></svg><span></span>`;
      $('span', el).textContent = message;
      wrap.appendChild(el);
      setTimeout(() => {
        el.dataset.leaving = 'true';
        setTimeout(() => el.remove(), 260);
      }, ms);
    }
  };

  /* ------------------------------------------------------------------ *
   * Copy to clipboard
   * ------------------------------------------------------------------ */
  const Copy = {
    init() {
      $$('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const value = btn.dataset.copy;
          try {
            await navigator.clipboard.writeText(value);
            Toast.show(`Copiat: ${value}`);
          } catch (err) {
            Toast.show('Nu am putut copia. Selectează manual textul.');
          }
        });
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Command palette (Ctrl/Cmd + K)
   * ------------------------------------------------------------------ */
  const Palette = {
    index: [],
    init() {
      const dlg = $('[data-palette]');
      if (!dlg) return;
      const input = $('[data-palette-input]', dlg);
      const results = $('[data-palette-results]', dlg);
      const base = document.documentElement.dataset.base || '';

      this.index = [
        { g: 'Programare', t: 'Programează o ședință', u: 'programare.html', k: 'programare rezervare sedinta booking calendar' },
        { g: 'Programare', t: 'Programare psihoterapie', u: 'programare.html#psihoterapie', k: 'psihoterapie' },
        { g: 'Programare', t: 'Programare evaluare psihologică', u: 'programare.html#evaluare', k: 'evaluare clinica' },
        { g: 'Servicii', t: 'Evaluare psihologică (psihologie clinică)', u: 'servicii/psihologie-clinica.html', k: 'evaluare clinica interventie primara CES' },
        { g: 'Servicii', t: 'Consiliere psihologică', u: 'servicii/consiliere-psihologica.html', k: 'consiliere bunastare sentimente' },
        { g: 'Servicii', t: 'Terapie depresie–anxietate', u: 'servicii/terapie-depresie-anxietate.html', k: 'depresie anxietate stres atac de panica' },
        { g: 'Servicii', t: 'Terapie de cuplu', u: 'servicii/terapie-de-cuplu.html', k: 'cuplu relatie parteneri casnicie' },
        { g: 'Servicii', t: 'Terapie individuală', u: 'servicii/terapie-individuala.html', k: 'individuala personalitate emotii' },
        { g: 'Servicii', t: 'Dezvoltare personală', u: 'servicii/dezvoltare-personala.html', k: 'dezvoltare personala crestere iertare' },
        { g: 'Instrumente', t: 'Test de relaționare în cuplu', u: 'test-relationare.html', k: 'test quiz cuplu tipar atasament relationare' },
        { g: 'Instrumente', t: 'Check-in emoțional (2 minute)', u: 'test-relationare.html#checkin', k: 'checkin autoevaluare stare emotionala' },
        { g: 'Instrumente', t: 'Exercițiu de respirație 4-7-8', u: 'de-ce.html#respiratie', k: 'respiratie calmare anxietate exercitiu' },
        { g: 'Pagini', t: 'Acasă', u: 'index.html', k: 'acasa home prima pagina' },
        { g: 'Pagini', t: 'Despre mine', u: 'despre-mine.html', k: 'cosmin popescu psiholog cv formare acreditari' },
        { g: 'Pagini', t: 'Toate serviciile', u: 'servicii.html', k: 'servicii lista' },
        { g: 'Pagini', t: 'De ce? — semne că ai nevoie de terapie', u: 'de-ce.html', k: 'de ce semne psihoterapie cand' },
        { g: 'Pagini', t: 'Articole', u: 'articole.html', k: 'articole blog somn anxietate depresie' },
        { g: 'Pagini', t: 'Contact', u: 'contact.html', k: 'contact adresa telefon email harta' },
        { g: 'Contact', t: `Sună: ${EP.phone}`, u: `tel:${EP.phoneRaw}`, k: 'telefon suna apel' },
        { g: 'Contact', t: 'Scrie pe WhatsApp', u: waUrl(), k: 'whatsapp mesaj scrie' }
      ];
      if (EP.email) {
        this.index.push({ g: 'Contact', t: `Scrie: ${EP.email}`, u: `mailto:${EP.email}`, k: 'email mail scrie' });
      }

      const normalize = (s) => s.toLowerCase()
        .replace(/[șş]/g, 's')   /* ș ş */
        .replace(/[țţ]/g, 't')   /* ț ţ */
        .replace(/[ăâ]/g, 'a')   /* ă â */
        .replace(/î/g, 'i')           /* î   */
        .normalize('NFD').replace(/[̀-ͯ]/g, '');

      const render = (query = '') => {
        const q = normalize(query.trim());
        const matches = q
          ? this.index.filter((it) => normalize(it.t + ' ' + it.k + ' ' + it.g).includes(q))
          : this.index;
        results.innerHTML = '';
        if (!matches.length) {
          results.innerHTML = `<p class="palette__empty">Niciun rezultat. Încearcă „cuplu”, „anxietate” sau „programare”.</p>`;
          return;
        }
        const groups = matches.reduce((acc, it) => { (acc[it.g] ||= []).push(it); return acc; }, {});
        Object.entries(groups).forEach(([g, items]) => {
          const label = document.createElement('p');
          label.className = 'palette__group-label';
          label.textContent = g;
          results.appendChild(label);
          items.forEach((it) => {
            const a = document.createElement('a');
            a.className = 'palette__item';
            a.href = /^(https?:|tel:|mailto:)/.test(it.u) ? it.u : base + it.u;
            a.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5"/></svg><span></span>`;
            $('span', a).textContent = it.t;
            results.appendChild(a);
          });
        });
        const first = $('.palette__item', results);
        if (first) first.dataset.active = 'true';
      };

      const open = () => {
        if (dlg.open) return;
        render('');
        dlg.showModal();
        input.value = '';
        setTimeout(() => input.focus(), 40);
      };

      $$('[data-palette-open]').forEach((b) => b.addEventListener('click', open));
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
        if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
          e.preventDefault(); open();
        }
      });

      input.addEventListener('input', () => render(input.value));
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('keydown', (e) => {
        const items = $$('.palette__item', results);
        if (!items.length) return;
        let i = items.findIndex((el) => el.dataset.active === 'true');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          items.forEach((el) => delete el.dataset.active);
          i = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
          items[i].dataset.active = 'true';
          items[i].scrollIntoView({ block: 'nearest' });
        }
        if (e.key === 'Enter' && i >= 0) { e.preventDefault(); items[i].click(); }
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Carousel (testimonials)
   * ------------------------------------------------------------------ */
  const Carousel = {
    init() {
      $$('[data-carousel]').forEach((track) => {
        const scope = track.dataset.carousel;
        const prev = $(`[data-carousel-prev="${scope}"]`);
        const next = $(`[data-carousel-next="${scope}"]`);
        const step = () => {
          const card = track.firstElementChild;
          return card ? card.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
        };
        const update = () => {
          if (prev) prev.disabled = track.scrollLeft < 8;
          if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
        };
        if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
        if (next) next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
        track.addEventListener('scroll', update, { passive: true });
        update();
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Table of contents highlighting
   * ------------------------------------------------------------------ */
  const Toc = {
    init() {
      const toc = $('[data-toc]');
      if (!toc || !('IntersectionObserver' in window)) return;
      const links = $$('a[href^="#"]', toc);
      const targets = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
      if (!targets.length) return;
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === `#${entry.target.id}`)));
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      targets.forEach((t) => io.observe(t));
    }
  };

  /* ------------------------------------------------------------------ *
   * Breathing exercise (4-7-8)
   * ------------------------------------------------------------------ */
  const Breathe = {
    init() {
      const root = $('[data-breathe]');
      if (!root) return;
      const orb = $('.breathe__orb', root);
      const label = $('[data-breathe-label]', root);
      const btn = $('[data-breathe-toggle]', root);
      const counter = $('[data-breathe-cycles]', root);
      let timer = null, cycles = 0, running = false;

      const phases = [
        { name: 'in', text: 'Inspiră pe nas…', ms: 4000, count: 4 },
        { name: 'hold', text: 'Ține aerul…', ms: 7000, count: 7 },
        { name: 'out', text: 'Expiră lent pe gură…', ms: 8000, count: 8 }
      ];

      const stop = () => {
        running = false;
        clearTimeout(timer);
        root.dataset.phase = '';
        if (label) label.textContent = 'Apasă „Începe” pentru un ciclu de respirație 4-7-8.';
        if (orb) orb.textContent = '';
        if (btn) btn.textContent = 'Începe';
      };

      const run = (i = 0) => {
        if (!running) return;
        const p = phases[i];
        root.dataset.phase = p.name;
        if (label) label.textContent = p.text;
        let left = p.count;
        if (orb) orb.textContent = String(left);
        const tick = setInterval(() => {
          left -= 1;
          if (orb) orb.textContent = String(Math.max(left, 0));
          if (left <= 0) clearInterval(tick);
        }, 1000);
        timer = setTimeout(() => {
          clearInterval(tick);
          const nextIndex = (i + 1) % phases.length;
          if (nextIndex === 0) {
            cycles += 1;
            if (counter) counter.textContent = String(cycles);
            if (cycles >= 4) { stop(); Toast.show('Patru cicluri complete. Observă cum te simți acum.'); return; }
          }
          run(nextIndex);
        }, p.ms);
      };

      if (btn) btn.addEventListener('click', () => {
        if (running) { stop(); return; }
        running = true; cycles = 0;
        if (counter) counter.textContent = '0';
        btn.textContent = 'Oprește';
        run(0);
      });
      stop();
    }
  };

  /* ------------------------------------------------------------------ *
   * Self check-in — reflective, explicitly non-diagnostic
   * ------------------------------------------------------------------ */
  const CheckIn = {
    init() {
      const root = $('[data-checkin]');
      if (!root) return;
      const questions = $$('.checkin__q', root);
      const meter = $('[data-checkin-meter]', root);
      const out = $('[data-checkin-result]', root);
      const submit = $('[data-checkin-submit]', root);
      const reset = $('[data-checkin-reset]', root);
      const answers = new Map();

      $$('.scale__btn', root).forEach((btn) => {
        btn.addEventListener('click', () => {
          const q = btn.closest('.checkin__q');
          $$('.scale__btn', q).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          answers.set(q.dataset.q, Number(btn.dataset.score));
          const pct = (answers.size / questions.length) * 100;
          if (meter) meter.style.inlineSize = `${pct}%`;
          if (submit) submit.disabled = answers.size < questions.length;
        });
      });

      if (submit) submit.addEventListener('click', () => {
        const total = Array.from(answers.values()).reduce((a, b) => a + b, 0);
        const max = questions.length * 3;
        const ratio = total / max;
        let title, text;
        if (ratio < 0.3) {
          title = 'Resursele tale par să funcționeze';
          text = 'Răspunsurile tale sugerează un nivel scăzut de disconfort în ultimele două săptămâni. O ședință de dezvoltare personală te poate ajuta să consolidezi ceea ce merge deja bine.';
        } else if (ratio < 0.6) {
          title = 'Ceva te apasă mai mult decât de obicei';
          text = 'Există semne de tensiune care merită discutate. O ședință de consiliere psihologică poate clarifica ce anume consumă cel mai mult din energia ta.';
        } else {
          title = 'Ar fi util să nu duci asta singur';
          text = 'Răspunsurile indică un disconfort ridicat și persistent. Recomandarea este o evaluare psihologică inițială, urmată de un plan de psihoterapie adaptat situației tale.';
        }
        if (out) {
          out.hidden = false;
          $('[data-checkin-title]', out).textContent = title;
          $('[data-checkin-text]', out).textContent = text;
          out.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' });
        }
      });

      if (reset) reset.addEventListener('click', () => {
        answers.clear();
        $$('.scale__btn', root).forEach((b) => b.setAttribute('aria-pressed', 'false'));
        if (meter) meter.style.inlineSize = '0%';
        if (out) out.hidden = true;
        if (submit) submit.disabled = true;
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Relationship quiz — 4 relating patterns
   * ------------------------------------------------------------------ */
  const Quiz = {
    init() {
      const root = $('[data-quiz]');
      if (!root) return;
      const steps = $$('[data-quiz-step]', root);
      const bar = $('[data-quiz-progress]', root);
      const counter = $('[data-quiz-counter]', root);
      const result = $('[data-quiz-result]', root);
      const answers = [];
      let i = 0;

      const profiles = {
        s: {
          name: 'Tipar securizant',
          text: 'Te simți confortabil atât în apropiere, cât și în autonomie. Comunici direct ce ai nevoie și tolerezi bine conflictul, fără să îl transformi în amenințare. Terapia de cuplu îți poate servi ca spațiu de rafinare, nu de reparație.'
        },
        a: {
          name: 'Tipar anxios',
          text: 'Ai nevoie de reasigurări frecvente și tinzi să citești tăcerea partenerului ca pe un semn de respingere. Un obiectiv util în terapie este reglarea emoțională: să poți sta cu incertitudinea fără să escaladezi.'
        },
        e: {
          name: 'Tipar evitant',
          text: 'Te retragi când intensitatea crește și preferi să rezolvi singur. Aparent funcționează, dar distanța se acumulează. În terapie lucrăm la exprimarea nevoilor înainte ca retragerea să devină automată.'
        },
        d: {
          name: 'Tipar dezorganizat',
          text: 'Alternezi între apropiere intensă și retragere bruscă, adesea pe fondul unor experiențe timpurii nerezolvate. O evaluare psihologică inițială și un plan de terapie individuală, înainte sau în paralel cu cea de cuplu, este cel mai util punct de plecare.'
        }
      };

      const show = (n) => {
        steps.forEach((s, idx) => { s.hidden = idx !== n; });
        if (bar) bar.style.inlineSize = `${(n / steps.length) * 100}%`;
        if (counter) counter.textContent = `${Math.min(n + 1, steps.length)} / ${steps.length}`;
      };

      $$('[data-quiz-answer]', root).forEach((btn) => {
        btn.addEventListener('click', () => {
          answers[i] = btn.dataset.quizAnswer;
          i += 1;
          if (i < steps.length) { show(i); return; }
          if (bar) bar.style.inlineSize = '100%';
          const tally = answers.reduce((acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; }, {});
          const key = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
          const p = profiles[key] || profiles.s;
          steps.forEach((s) => { s.hidden = true; });
          if (result) {
            result.hidden = false;
            $('[data-quiz-name]', result).textContent = p.name;
            $('[data-quiz-text]', result).textContent = p.text;
            result.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' });
          }
        });
      });

      const restart = $('[data-quiz-restart]', root);
      if (restart) restart.addEventListener('click', () => {
        answers.length = 0; i = 0;
        if (result) result.hidden = true;
        show(0);
      });

      show(0);
    }
  };

  /* ------------------------------------------------------------------ *
   * Booking wizard
   * ------------------------------------------------------------------ */
  const Booking = {
    init() {
      const root = $('[data-wizard]');
      if (!root) return;

      const state = { service: null, serviceLabel: '', mode: 'cabinet', date: null, time: null, name: '', email: '', phone: '', note: '' };
      const steps = $$('[data-step]', root);
      const tabs = $$('[data-tab]', root);
      const back = $('[data-wizard-back]', root);
      const next = $('[data-wizard-next]', root);
      let current = 0;

      const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
      const DOW = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
      const SLOTS = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00', '18:30', '20:00'];

      /* ---- Step navigation ---- */
      const canAdvance = () => {
        if (current === 0) return !!state.service;
        if (current === 1) return !!(state.date && state.time);
        if (current === 2) return validateDetails(false);
        return true;
      };
      const paint = () => {
        steps.forEach((s, idx) => { s.hidden = idx !== current; });
        tabs.forEach((t, idx) => {
          t.dataset.state = idx === current ? 'active' : (idx < current ? 'done' : 'todo');
        });
        if (back) back.hidden = current === 0;
        if (next) {
          next.textContent = current === steps.length - 1 ? 'Trimite cererea' : 'Continuă';
          next.disabled = !canAdvance();
        }
        if (current === steps.length - 1) renderSummary();
      };
      const go = (n) => { current = Math.max(0, Math.min(n, steps.length - 1)); paint(); root.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' }); };

      if (back) back.addEventListener('click', () => go(current - 1));
      if (next) next.addEventListener('click', () => {
        if (current === 2 && !validateDetails(true)) return;
        if (current === steps.length - 1) { submit(); return; }
        go(current + 1);
      });

      /* ---- Step 1: service ---- */
      $$('[data-service]', root).forEach((btn) => {
        btn.addEventListener('click', () => {
          $$('[data-service]', root).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          state.service = btn.dataset.service;
          state.serviceLabel = $('b', btn) ? $('b', btn).textContent.trim() : btn.dataset.service;
          paint();
        });
      });
      const modeRoot = $('[data-segmented="mod"]', root);
      if (modeRoot) modeRoot.addEventListener('segment:change', (e) => { state.mode = e.detail.value; });

      /* ---- Step 2: calendar ---- */
      const cal = $('[data-cal]', root);
      const calTitle = $('[data-cal-title]', root);
      const calGrid = $('[data-cal-grid]', root);
      const slotWrap = $('[data-slots]', root);
      const slotLabel = $('[data-slot-label]', root);
      let view = new Date(); view.setDate(1);

      const isPast = (d) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return d < today;
      };
      const isClosed = (d) => d.getDay() === 0; /* duminica */

      const renderCal = () => {
        if (!calGrid) return;
        calGrid.innerHTML = '';
        if (calTitle) calTitle.textContent = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
        DOW.forEach((d) => {
          const el = document.createElement('div');
          el.className = 'cal__dow';
          el.textContent = d;
          calGrid.appendChild(el);
        });
        const first = new Date(view.getFullYear(), view.getMonth(), 1);
        const offset = (first.getDay() + 6) % 7;
        for (let i = 0; i < offset; i += 1) calGrid.appendChild(document.createElement('div'));
        const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
        const today = new Date();
        for (let d = 1; d <= days; d += 1) {
          const date = new Date(view.getFullYear(), view.getMonth(), d);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cal__day';
          btn.textContent = String(d);
          btn.disabled = isPast(date) || isClosed(date);
          btn.setAttribute('aria-pressed', String(!!state.date && state.date.toDateString() === date.toDateString()));
          if (date.toDateString() === today.toDateString()) btn.dataset.today = 'true';
          btn.setAttribute('aria-label', `${d} ${MONTHS[view.getMonth()]} ${view.getFullYear()}`);
          btn.addEventListener('click', () => {
            state.date = date; state.time = null;
            renderCal(); renderSlots(); paint();
          });
          calGrid.appendChild(btn);
        }
      };

      const renderSlots = () => {
        if (!slotWrap) return;
        slotWrap.innerHTML = '';
        if (!state.date) {
          if (slotLabel) slotLabel.textContent = 'Alege mai întâi o zi din calendar.';
          return;
        }
        if (slotLabel) {
          slotLabel.textContent = `Intervale disponibile · ${state.date.getDate()} ${MONTHS[state.date.getMonth()]}`;
        }
        /* Deterministic pseudo-availability so the demo stays stable per day. */
        const seed = state.date.getDate() + state.date.getMonth() * 31;
        SLOTS.forEach((t, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'slot';
          btn.textContent = t;
          btn.disabled = (seed + idx * 3) % 5 === 0 || (state.date.getDay() === 6 && idx > 3);
          btn.setAttribute('aria-pressed', String(state.time === t));
          btn.addEventListener('click', () => {
            state.time = t;
            $$('.slot', slotWrap).forEach((s) => s.setAttribute('aria-pressed', String(s === btn)));
            paint();
          });
          slotWrap.appendChild(btn);
        });
      };

      const prevM = $('[data-cal-prev]', root);
      const nextM = $('[data-cal-next]', root);
      if (prevM) prevM.addEventListener('click', () => { view.setMonth(view.getMonth() - 1); renderCal(); });
      if (nextM) nextM.addEventListener('click', () => { view.setMonth(view.getMonth() + 1); renderCal(); });
      if (cal) { renderCal(); renderSlots(); }

      /* ---- Step 3: details ---- */
      const fields = {
        name: $('[data-field="name"]', root),
        email: $('[data-field="email"]', root),
        phone: $('[data-field="phone"]', root),
        note: $('[data-field="note"]', root),
        gdpr: $('[data-field="gdpr"]', root)
      };
      Object.entries(fields).forEach(([key, el]) => {
        if (!el) return;
        el.addEventListener('input', () => {
          state[key] = el.type === 'checkbox' ? el.checked : el.value;
          const f = el.closest('.field');
          if (f) f.dataset.invalid = 'false';
          paint();
        });
        el.addEventListener('change', () => {
          state[key] = el.type === 'checkbox' ? el.checked : el.value;
          paint();
        });
      });

      function validateDetails(report) {
        const checks = [
          [fields.name, (v) => v.trim().length >= 3],
          [fields.email, (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())],
          [fields.phone, (v) => v.replace(/[^\d]/g, '').length >= 9]
        ];
        let ok = true;
        checks.forEach(([el, test]) => {
          if (!el) return;
          const valid = test(el.value || '');
          if (!valid) ok = false;
          if (report) {
            const f = el.closest('.field');
            if (f) f.dataset.invalid = String(!valid);
          }
        });
        if (fields.gdpr && !fields.gdpr.checked) {
          ok = false;
          if (report) Toast.show('Te rog confirmă acordul privind prelucrarea datelor.');
        }
        return ok;
      }

      /* ---- Step 4: summary + handoff ---- */
      function fmtDate() {
        if (!state.date) return '—';
        return `${state.date.getDate()} ${MONTHS[state.date.getMonth()]} ${state.date.getFullYear()}`;
      }
      function renderSummary() {
        const map = {
          service: state.serviceLabel || '—',
          mode: state.mode === 'online' ? 'Online (Google Meet)' : `În cabinet${EP.address ? ` · ${EP.address}` : ''}`,
          date: fmtDate(),
          time: state.time || '—',
          name: state.name || '—',
          email: state.email || '—',
          phone: state.phone || '—'
        };
        Object.entries(map).forEach(([k, v]) => {
          const el = $(`[data-sum="${k}"]`, root);
          if (el) el.textContent = v;
        });
      }
      function message() {
        return [
          `Cerere de programare — ${EP.person}`,
          '',
          `Serviciu: ${state.serviceLabel}`,
          `Format: ${state.mode === 'online' ? 'Online (Google Meet)' : 'În cabinet'}`,
          `Data: ${fmtDate()}`,
          `Ora: ${state.time}`,
          '',
          `Nume: ${state.name}`,
          `Email: ${state.email}`,
          `Telefon: ${state.phone}`,
          state.note ? `Mențiuni: ${state.note}` : ''
        ].filter(Boolean).join('\n');
      }
      function submit() {
        const via = handOff(`Programare ${state.serviceLabel} — ${fmtDate()}, ${state.time}`, message());
        Toast.show(via === 'email'
          ? 'Se deschide aplicația de email cu cererea completată.'
          : 'Se deschide WhatsApp cu cererea completată.');
      }
      const wa = $('[data-wizard-whatsapp]', root);
      if (wa) wa.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(waUrl(message()), '_blank', 'noopener');
      });
      const ics = $('[data-wizard-ics]', root);
      if (ics) ics.addEventListener('click', (e) => {
        e.preventDefault();
        if (!state.date || !state.time) return;
        const [h, m] = state.time.split(':').map(Number);
        const start = new Date(state.date); start.setHours(h, m, 0, 0);
        const end = new Date(start.getTime() + 50 * 60000);
        const z = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
        const content = [
          'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${EP.person}//RO`,
          'BEGIN:VEVENT', `DTSTAMP:${z(new Date())}`, `DTSTART:${z(start)}`, `DTEND:${z(end)}`,
          `SUMMARY:${state.serviceLabel} — ${EP.person}`,
          `DESCRIPTION:${state.mode === 'online' ? 'Ședință online (Google Meet)' : 'Ședință în cabinet'}`,
          `LOCATION:${state.mode === 'online' ? 'Online' : (EP.address || 'Cabinet')}`,
          'END:VEVENT', 'END:VCALENDAR'
        ].join('\r\n');
        const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar' }));
        const a = document.createElement('a');
        a.href = url; a.download = 'programare.ics';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        Toast.show('Fișier .ics descărcat — adaugă-l în calendarul tău.');
      });

      paint();
    }
  };

  /* ------------------------------------------------------------------ *
   * Contact form — client-side validation, graceful handoff
   * ------------------------------------------------------------------ */
  const ContactForm = {
    init() {
      const form = $('[data-contact-form]');
      if (!form) return;
      const rules = {
        name: (v) => v.trim().length >= 3,
        email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
        phone: (v) => v.replace(/[^\d]/g, '').length >= 9,
        subject: (v) => v.trim().length >= 3,
        message: (v) => v.trim().length >= 12
      };
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        let ok = true;
        Object.entries(rules).forEach(([name, test]) => {
          const el = form.elements[name];
          if (!el) return;
          const valid = test(el.value || '');
          const f = el.closest('.field');
          if (f) f.dataset.invalid = String(!valid);
          if (!valid && ok) { el.focus(); ok = false; }
        });
        const gdpr = form.elements.gdpr;
        if (gdpr && !gdpr.checked) { Toast.show('Te rog confirmă acordul privind prelucrarea datelor.'); return; }
        if (!ok) { Toast.show('Verifică te rog câmpurile marcate.'); return; }

        const body = `${form.elements.message.value}\n\n—\n${form.elements.name.value}\n${form.elements.email.value}\n${form.elements.phone.value}`;
        const via = handOff(form.elements.subject.value, body);
        Toast.show(via === 'email'
          ? 'Mulțumesc. Se deschide aplicația de email cu mesajul completat.'
          : 'Mulțumesc. Se deschide WhatsApp cu mesajul completat.');
      });
      $$('input, textarea', form).forEach((el) => {
        el.addEventListener('input', () => {
          const f = el.closest('.field');
          if (f) f.dataset.invalid = 'false';
        });
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Cookie consent
   * ------------------------------------------------------------------ */
  const Cookies = {
    key: 'ep-cookie-consent',
    init() {
      const el = $('[data-cookie]');
      if (!el) return;
      let stored = null;
      try { stored = localStorage.getItem(this.key); } catch (e) { stored = 'skip'; }
      /* The flag on <html> lets the mobile dock and the back-to-top button
         retreat while the sheet is up, instead of stacking on top of it. */
      if (!stored) setTimeout(() => {
        el.dataset.open = 'true';
        document.documentElement.dataset.cookieOpen = 'true';
      }, 1400);
      const close = (value) => {
        try { localStorage.setItem(this.key, value); } catch (e) { /* noop */ }
        el.dataset.open = 'false';
        delete document.documentElement.dataset.cookieOpen;
      };
      $$('[data-cookie-accept]', el).forEach((b) => b.addEventListener('click', () => { close('all'); Toast.show('Preferințe salvate.'); }));
      $$('[data-cookie-essential]', el).forEach((b) => b.addEventListener('click', () => { close('essential'); Toast.show('Doar cookie-urile esențiale rămân active.'); }));
    }
  };

  /* ------------------------------------------------------------------ *
   * Share buttons — native share with fallback
   * ------------------------------------------------------------------ */
  const Share = {
    init() {
      $$('[data-share]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          if (!navigator.share) return; /* let the href do its job */
          e.preventDefault();
          try {
            await navigator.share({ title: document.title, url: window.location.href });
          } catch (err) { /* dismissed */ }
        });
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Click-to-load map — no third-party request until the visitor asks
   * ------------------------------------------------------------------ */
  const Map_ = {
    init() {
      $$('[data-map]').forEach((frame) => {
        const btn = $('[data-map-load]', frame);
        if (!btn) return;
        btn.addEventListener('click', () => {
          const iframe = document.createElement('iframe');
          iframe.src = frame.dataset.src;
          iframe.loading = 'lazy';
          iframe.referrerPolicy = 'no-referrer';
          iframe.title = `Hartă — ${EP.address || 'locația cabinetului'}`;
          frame.innerHTML = '';
          frame.appendChild(iframe);
        });
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Deep link: programare.html?s=<slug> preselects the service
   * ------------------------------------------------------------------ */
  const DeepLink = {
    init() {
      const slug = new URLSearchParams(window.location.search).get('s');
      if (!slug) return;
      const alias = {
        psihoterapie: 'terapie-individuala',
        evaluare: 'psihologie-clinica',
        clinica: 'psihologie-clinica',
        consiliere: 'consiliere-psihologica',
        dezvoltare: 'dezvoltare-personala',
        cuplu: 'terapie-de-cuplu'
      };
      const target = $(`[data-service="${alias[slug] || slug}"]`);
      if (target) setTimeout(() => target.click(), 120);
    }
  };

  /* ------------------------------------------------------------------ *
   * Tesseract — the signature motif. A 4-cube turning in the XW and YZ
   * planes, projected 4D -> 3D -> 2D. The build ships one frozen pose in
   * the markup, so the figure is already complete if this never runs.
   * ------------------------------------------------------------------ */
  const Tesseract = {
    verts: Array.from({ length: 16 }, (_, i) =>
      [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]),

    edges: (() => {
      const e = [];
      for (let i = 0; i < 16; i++) {
        for (let b = 0; b < 4; b++) { const j = i ^ (1 << b); if (j > i) e.push([i, j]); }
      }
      return e;
    })(),

    init() {
      const targets = $$('[data-tesseract]')
        .map((svg) => ({ svg, lines: $$('line', svg) }))
        .filter((t) => t.lines.length === this.edges.length);
      if (!targets.length || prefersReduced()) return;

      /* Off-screen copies keep their last pose instead of burning frames. */
      const io = 'IntersectionObserver' in window
        ? new IntersectionObserver((es) => es.forEach((e) => { e.target.dataset.vis = e.isIntersecting ? '1' : '0'; }))
        : null;
      targets.forEach((t) => { t.svg.dataset.vis = '1'; if (io) io.observe(t.svg); });

      const t0 = performance.now();
      const tick = (now) => {
        const s = (now - t0) / 1000;
        targets.forEach((t) => { if (t.svg.dataset.vis !== '0') this.paint(t, s * 0.19, s * 0.26); });
        raf(tick);
      };
      raf(tick);
    },

    /* Rotation, then two perspective divides. Returns the screen point plus a
       0..1 depth, which only decides how strongly the edge reads. */
    project([x, y, z, w], a, b) {
      /* 4D: the XW plane only. That is the turn that folds the inner cube out
         through the outer one — tumbling in two planes at once just reads as
         noise at this size. */
      const ca = Math.cos(a), sa = Math.sin(a);
      [x, w] = [x * ca - w * sa, x * sa + w * ca];
      const k4 = 2.6 / (3.1 - w);
      x *= k4; y *= k4; z *= k4;

      /* 3D: a spin around Y, then a fixed 17° tilt so the cubes read as cubes. */
      const cb = Math.cos(b), sb = Math.sin(b);
      [x, z] = [x * cb - z * sb, x * sb + z * cb];
      const ct = 0.9553, st = 0.2955;
      [y, z] = [y * ct - z * st, y * st + z * ct];

      const k3 = 2.8 / (3.6 - z);
      return [x * k3 * 40, y * k3 * 40, (k4 - 0.63) / 0.61];
    },

    paint(t, a, b) {
      const p = this.verts.map((v) => this.project(v, a, b));
      t.lines.forEach((ln, i) => {
        const [s, e] = this.edges[i];
        ln.setAttribute('x1', p[s][0].toFixed(2));
        ln.setAttribute('y1', p[s][1].toFixed(2));
        ln.setAttribute('x2', p[e][0].toFixed(2));
        ln.setAttribute('y2', p[e][1].toFixed(2));
        const d = Math.min(1, Math.max(0, (p[s][2] + p[e][2]) / 2));
        ln.setAttribute('stroke-opacity', (0.42 + 0.58 * d).toFixed(3));
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  const boot = () => {
    [Theme, Chrome, Drawer, Reveal, Glow, Counters, Segmented, Copy, Palette,
      Carousel, Toc, Breathe, Tesseract, CheckIn, Quiz, Booking, ContactForm,
      Cookies, Share, Map_, DeepLink]
      .forEach((m) => { try { m.init(); } catch (err) { console.warn('[ep]', err); } });
    document.documentElement.dataset.ready = 'true';
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
