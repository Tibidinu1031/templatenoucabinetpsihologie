#!/usr/bin/env node
/* ==========================================================================
   Șablon de site pentru cabinet de psihologie — generator static
   Reads _build/pages/*.html fragments, wraps them in the shared chrome and
   writes plain static HTML to the project root. No runtime dependency:
   the output is the site.

     node _build/build.js
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = path.join(__dirname, 'pages');

/* --------------------------------------------------------------------------
   Single source of truth for identity and contact details.
   `email`, `address` and `origin` are intentionally empty: every template
   below degrades gracefully when a field is missing, so the site can go live
   with just a phone number and gain the rest later without a redesign.
   -------------------------------------------------------------------------- */
const SITE = {
  /* Toate valorile sunt substituenți de șablon. Nu descriu un cabinet real și
     nu trebuie publicate ca atare — se înlocuiesc înainte de lansare. */
  name: 'Meridian',                 // marca cabinetului, nu o persoană
  person: 'Meridian',               // folosit în mesajele generate (WhatsApp, .ics)
  practice: 'Cabinet de psihologie',
  role: 'Psihoterapie cognitiv-comportamentală',
  phone: '07xx xxx xxx',
  phoneRaw: '+40700000000',
  wa: '40700000000',
  hours: 'Luni–Sâmbătă, 09:00–21:00',
  email: '',      // TODO: de completat
  address: '',    // TODO: de completat
  origin: ''      // TODO: domeniul final, pentru canonical / OG / sitemap
};

const waLink = (text) =>
  `https://wa.me/${SITE.wa}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/* --------------------------------------------------------------------------
   Icons — a tiny hand-tuned set. Stroke-based, 20×20 grid, 1.5 weight.
   -------------------------------------------------------------------------- */
const I = {
  clipboard: '<path d="M7.5 3.5h5M7.5 3.5a1.5 1.5 0 0 0-1.5 1.5v.5H5a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 5 16.5h10a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 15 5.5h-1V5a1.5 1.5 0 0 0-1.5-1.5M7 10h6M7 13h4"/>',
  compass: '<circle cx="10" cy="10" r="7"/><path d="m12.6 7.4-1.5 3.7-3.7 1.5 1.5-3.7z"/>',
  waves: '<path d="M3 7.5c1.6-1.6 3.1-1.6 4.7 0s3.1 1.6 4.7 0 3.1-1.6 4.6 0M3 12c1.6-1.6 3.1-1.6 4.7 0s3.1 1.6 4.7 0 3.1-1.6 4.6 0"/>',
  hearts: '<path d="M10 16.2S4 12.7 4 8.7A3 3 0 0 1 10 7.4a3 3 0 0 1 6 1.3c0 4-6 7.5-6 7.5Z"/>',
  person: '<circle cx="10" cy="6.8" r="3.1"/><path d="M4.2 16.4a5.9 5.9 0 0 1 11.6 0"/>',
  sprout: '<path d="M10 16.5V9M10 9C10 6.5 8 4.5 5 4.5c0 3 2 4.5 5 4.5Zm0 1.6c0-2.2 1.8-4 4.5-4 0 2.6-1.8 4-4.5 4Z"/>',
  video: '<rect x="3" y="5.5" width="9.5" height="9" rx="2"/><path d="m12.5 10.5 4.5-2.7v4.4l-4.5-2.7Z"/>',
  phone: '<path d="M6.2 3.8 8 3l1.6 3.2-1.4 1.4a9 9 0 0 0 4.2 4.2l1.4-1.4L17 12l-.8 1.8a2 2 0 0 1-2.2 1.1A12.5 12.5 0 0 1 4.1 6a2 2 0 0 1 1.1-2.2Z"/>',
  mail: '<rect x="3" y="5" width="14" height="10" rx="2"/><path d="m3.6 6 6.4 4.6L16.4 6"/>',
  pin: '<path d="M10 17s5.2-4.6 5.2-8.4a5.2 5.2 0 1 0-10.4 0C4.8 12.4 10 17 10 17Z"/><circle cx="10" cy="8.6" r="1.9"/>',
  clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6.2V10l2.6 1.6"/>',
  shield: '<path d="M10 3.2 15.4 5v4.4c0 3.3-2.2 6.1-5.4 7.4-3.2-1.3-5.4-4.1-5.4-7.4V5Z"/><path d="m7.7 10 1.7 1.7 3-3.2"/>',
  spark: '<path d="M10 3.4 11.5 8 16 9.5 11.5 11 10 15.6 8.5 11 4 9.5 8.5 8Z"/>',
  chat: '<path d="M16.5 9.6c0 3-2.9 5.4-6.5 5.4a8 8 0 0 1-2-.25L4.2 16l.8-2.8A5.1 5.1 0 0 1 3.5 9.6C3.5 6.6 6.4 4.2 10 4.2s6.5 2.4 6.5 5.4Z"/>',
  arrow: '<path d="M4 10h11M10.5 5.2 15.3 10l-4.8 4.8"/>',
  chevron: '<path d="m5.5 7.8 4.5 4.4 4.5-4.4"/>',
  chevronR: '<path d="m7.8 4.8 4.4 5.2-4.4 5.2"/>',
  search: '<circle cx="9" cy="9" r="5.2"/><path d="m13 13 3.5 3.5"/>',
  sun: '<circle cx="10" cy="10" r="3.4"/><path d="M10 2.6v1.8M10 15.6v1.8M17.4 10h-1.8M4.4 10H2.6M15.2 4.8l-1.3 1.3M6.1 13.9l-1.3 1.3M15.2 15.2l-1.3-1.3M6.1 6.1 4.8 4.8"/>',
  moon: '<path d="M16 11.6A6.6 6.6 0 0 1 8.4 4a6.8 6.8 0 1 0 7.6 7.6Z"/>',
  up: '<path d="M10 15.5v-11M5.4 9.1 10 4.5l4.6 4.6"/>',
  check: '<path d="m4.5 10.5 3.6 3.6L15.5 6"/>',
  whatsapp: '<path d="M4 16.2 5.1 13a6.2 6.2 0 1 1 2.3 2.2L4 16.2Z"/><path d="M8 8.2c.2 1.5 1.6 3 3.1 3.3l.8-1 1.4.7c-.2.8-1 1.2-1.8 1a5.4 5.4 0 0 1-3.9-3.9c-.2-.8.2-1.6 1-1.8l.7 1.4-1.3.3Z"/>',
  calendar: '<rect x="3.5" y="5" width="13" height="11.5" rx="2"/><path d="M3.5 8.6h13M7 3.5v2.6M13 3.5v2.6"/>',
  lock: '<rect x="4.5" y="8.8" width="11" height="7.7" rx="2"/><path d="M7.2 8.8V7a2.8 2.8 0 0 1 5.6 0v1.8"/>',
  book: '<path d="M4 4.6h4.2A2 2 0 0 1 10 6.4v9a1.6 1.6 0 0 0-1.4-.9H4Z"/><path d="M16 4.6h-4.2A2 2 0 0 0 10 6.4v9a1.6 1.6 0 0 1 1.4-.9H16Z"/>',
  scale: '<path d="M10 4v12M6 7.5 3.5 13h5L6 7.5Zm8 0L11.5 13h5L14 7.5ZM6 7.5h8M7.5 16.5h5"/>',
  users: '<circle cx="7.6" cy="7.4" r="2.6"/><path d="M3 15.6a4.7 4.7 0 0 1 9.2 0"/><path d="M13.4 5.2a2.6 2.6 0 0 1 0 4.9M14.4 11.6a4.7 4.7 0 0 1 2.6 4"/>'
};
/* width/height are intrinsic on purpose: an inline <svg> with only a viewBox
   stretches to fill whatever box it lands in. CSS still overrides these. */
/* Marca vizuală — un meridian: cerc plus arce. Neutră, fără inițiale de persoană. */
const mark = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M12 3.4c2.9 2.4 2.9 14.8 0 17.2M12 3.4c-2.9 2.4-2.9 14.8 0 17.2M3.7 9.2h16.6M3.7 14.8h16.6"/></svg>`;

const icon = (name, cls = '') =>
  `<svg class="${cls}" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || ''}</svg>`;

/* --------------------------------------------------------------------------
   Services — single source of truth. Placeholder copy, written for the template.
   -------------------------------------------------------------------------- */
const SERVICES = [
  {
    slug: 'psihologie-clinica',
    nav: 'Evaluare psihologică',
    title: 'Evaluare psihologică',
    sub: 'Interviu clinic și raport scris',
    icon: 'clipboard',
    short: 'Interviu clinic structurat și instrumente standardizate, urmate de un raport scris în cuvinte pe care le poți folosi: ce se întâmplă, de când, ce menține situația și ce opțiuni există mai departe.',
    lede: 'Înainte de a alege o direcție, merită să știi exact din ce punct pleci.',
    duration: '60–90 minute',
    format: 'În cabinet sau online',
    outcome: 'Raport psihologic și recomandări',
    for: [
      'Ai nevoie de o imagine clară înainte de a începe un proces terapeutic.',
      'Vrei să înțelegi dacă ceea ce trăiești se încadrează într-un tipar cunoscut.',
      'Îți trebuie un document scris pentru un alt specialist sau o instituție.'
    ]
  },
  {
    slug: 'consiliere-psihologica',
    nav: 'Consiliere psihologică',
    title: 'Consiliere psihologică',
    sub: 'Sprijin pentru decizii și tranziții',
    icon: 'compass',
    short: 'Un spațiu structurat pentru perioadele în care viața se schimbă mai repede decât apuci să te adaptezi: decizii grele, roluri noi, presiune care s-a adunat fără să observi.',
    lede: 'Nu orice greutate este o tulburare. Uneori e nevoie doar de un loc unde să gândești limpede.',
    duration: '50 de minute',
    format: 'În cabinet sau online',
    outcome: 'Direcție clară și pași concreți',
    for: [
      'Treci printr-o schimbare majoră și nu știi de unde să apuci.',
      'Amâni o decizie de luni de zile și te consumă mai mult decât decizia însăși.',
      'Vrei instrumente practice, nu doar un loc unde să te descarci.'
    ]
  },
  {
    slug: 'terapie-depresie-anxietate',
    nav: 'Terapie depresie-anxietate',
    title: 'Terapie depresie–anxietate',
    sub: 'Intervenție cognitiv-comportamentală',
    icon: 'waves',
    short: 'Program structurat pentru îngrijorarea care nu se oprește, atacurile de panică, evitarea care se extinde treptat și pierderea interesului pentru lucrurile care contau.',
    lede: 'Anxietatea și depresia răspund la o intervenție cu obiective clare și pași verificabili.',
    duration: '50 de minute',
    format: 'În cabinet sau online',
    outcome: 'Simptome reduse și un plan de prevenire',
    for: [
      'Îngrijorarea rulează în fundal aproape tot timpul.',
      'Eviți situații care înainte îți erau simple, iar lista crește.',
      'Dimineața e cea mai grea parte a zilei, de destule săptămâni.'
    ]
  },
  {
    slug: 'terapie-de-cuplu',
    nav: 'Terapie de cuplu',
    title: 'Terapie de cuplu',
    sub: 'Pentru amândoi, în aceeași încăpere',
    icon: 'hearts',
    short: 'Lucrăm pe tiparul de interacțiune, nu pe lista de reproșuri: cine se retrage, cine insistă, în ce moment se pierde conversația și ce ar fi nevoie ca ea să continue.',
    lede: 'Nu caut vinovatul. Caut bucla în care ajungeți amândoi, din nou și din nou.',
    duration: '80 de minute',
    format: 'În cabinet sau online, împreună',
    outcome: 'Un alt mod de a purta aceleași discuții',
    for: [
      'Aceeași ceartă se repetă, doar cu alte cuvinte.',
      'Distanța dintre voi a devenit vizibilă și pentru ceilalți.',
      'Vreți să reconstruiți încrederea după o ruptură.'
    ]
  },
  {
    slug: 'terapie-individuala',
    nav: 'Terapie individuală',
    title: 'Terapie individuală',
    sub: 'Un proces în ritmul tău',
    icon: 'person',
    short: 'Un cadru constant în care poți spune lucrurile pe care nu le spui nicăieri altundeva — și în care ele chiar duc undeva, ședință după ședință.',
    lede: 'Un loc în care nu trebuie să pari în regulă ca să fii primit.',
    duration: '50 de minute',
    format: 'În cabinet sau online',
    outcome: 'Schimbare care ține, nu alinare de moment',
    for: [
      'Te lovești de aceleași blocaje, în relații și în muncă.',
      'Ceva din trecut încă îți dictează reacțiile din prezent.',
      'Vrei să te înțelegi, nu doar să funcționezi.'
    ]
  },
  {
    slug: 'dezvoltare-personala',
    nav: 'Dezvoltare personală',
    title: 'Dezvoltare personală',
    sub: 'Creștere, nu reparație',
    icon: 'sprout',
    short: 'Pentru cine funcționează bine și vrea mai mult: obiective clare, limite mai ferme, o relație mai bună cu propriile standarde și un mod de a urmări progresul.',
    lede: 'Nu ai nevoie de o criză ca să meriți un spațiu de gândire.',
    duration: '50 de minute',
    format: 'În cabinet sau online',
    outcome: 'Obiective clare și un mod de a le urmări',
    for: [
      'Funcționezi bine, dar simți că te-ai oprit din creștere.',
      'Spui „da” din reflex și plătești asta mai târziu.',
      'Ai obiective, dar nu ai un sistem care să te ducă acolo.'
    ]
  }
];

/* --------------------------------------------------------------------------
   Chrome
   -------------------------------------------------------------------------- */
const megaLinks = (base) => SERVICES.map((s) => `
            <a class="megamenu__link" href="${base}servicii/${s.slug}.html">
              <span class="megamenu__icon">${icon(s.icon)}</span>
              <span>
                <span class="megamenu__title">${s.title}</span>
                <span class="megamenu__desc">${s.sub}</span>
              </span>
            </a>`).join('');

const NAV = [
  { label: 'Acasă', href: 'index.html', key: 'acasa' },
  { label: 'Despre mine', href: 'despre-mine.html', key: 'despre' },
  { label: 'Servicii', href: 'servicii.html', key: 'servicii', mega: true },
  { label: 'De ce?', href: 'de-ce.html', key: 'de-ce' },
  { label: 'Articole', href: 'articole.html', key: 'articole' },
  { label: 'Contact', href: 'contact.html', key: 'contact' }
];

const header = (base, active) => `
  <a class="skip-link" href="#main">Sari la conținut</a>

  <div class="topbar no-print">
    <div class="container topbar__inner">
      <ul class="topbar__list" role="list">
        ${SITE.address ? `<li class="topbar__item">${icon('pin')}<span>${SITE.address}</span></li>` : `<li class="topbar__item">${icon('video')}<span>Ședințe în cabinet și online</span></li>`}
        <li class="topbar__item">${icon('clock')}<span>${SITE.hours}</span></li>
      </ul>
      <ul class="topbar__list" role="list">
        ${SITE.email ? `<li class="topbar__item">${icon('mail')}<a href="mailto:${SITE.email}">${SITE.email}</a></li>` : ''}
        <li class="topbar__item">${icon('whatsapp')}<a href="${waLink()}" target="_blank" rel="noopener">WhatsApp</a></li>
        <li class="topbar__item">${icon('phone')}<a href="tel:${SITE.phoneRaw}">${SITE.phone}</a></li>
      </ul>
    </div>
  </div>

  <header class="site-header no-print" data-header>
    <div class="container">
      <nav class="nav" aria-label="Navigație principală">
        <a class="logo" href="${base}index.html" aria-label="${SITE.name} — acasă">
          <span class="logo__mark">${mark()}</span>
          <span class="logo__text">
            <span class="logo__name">${SITE.name}</span>
            <span class="logo__sub">${SITE.practice}</span>
          </span>
        </a>

        <ul class="nav__list" role="list">
          ${NAV.map((n) => `<li class="nav__item${n.mega ? ' nav__item--has-menu' : ''}">
            <a class="nav__link" href="${base}${n.href}"${active === n.key ? ' aria-current="page"' : ''}>${n.label}${n.mega ? icon('chevron', 'nav__caret') : ''}</a>
            ${n.mega ? `<div class="megamenu">
              <div class="megamenu__grid">${megaLinks(base)}</div>
              <div class="megamenu__foot">
                <span>Fiecare serviciu este disponibil în cabinet și online.</span>
                <a class="link" href="${base}servicii.html">Vezi toate serviciile ${icon('arrow')}</a>
              </div>
            </div>` : ''}
          </li>`).join('\n          ')}
        </ul>

        <div class="nav__actions">
          <button class="search-trigger" type="button" data-palette-open aria-label="Caută pe site">
            ${icon('search')}<span>Caută…</span><kbd class="kbd">Ctrl K</kbd>
          </button>
          <button class="icon-btn" type="button" data-theme-toggle aria-pressed="false">
            ${icon('sun').replace('<svg', '<svg data-icon="sun" hidden')}
            ${icon('moon').replace('<svg', '<svg data-icon="moon"')}
          </button>
          <a class="btn btn--primary btn--sm hide-md" href="${base}programare.html">
            Programare ${icon('arrow', 'btn__icon btn__icon--arrow')}
          </a>
          <button class="icon-btn burger" type="button" data-drawer-open aria-expanded="false" aria-controls="drawer" aria-label="Deschide meniul">
            <span class="burger__box" aria-hidden="true"><span></span><span></span><span></span></span>
          </button>
        </div>
      </nav>
    </div>
    <div class="progress" data-progress aria-hidden="true"></div>
  </header>

  <div class="drawer" id="drawer" data-drawer data-open="false" aria-hidden="true">
    <div class="drawer__scrim"></div>
    <div class="drawer__panel" role="dialog" aria-modal="true" aria-label="Meniu">
      <div class="drawer__head">
        <span class="eyebrow eyebrow--bare">Meniu</span>
        <button class="icon-btn" type="button" data-drawer-close aria-label="Închide meniul">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m5.5 5.5 9 9m0-9-9 9"/></svg>
        </button>
      </div>
      <ul class="drawer__nav" role="list">
        <li><a class="drawer__link" href="${base}index.html">Acasă ${icon('chevronR')}</a></li>
        <li><a class="drawer__link" href="${base}despre-mine.html">Despre mine ${icon('chevronR')}</a></li>
        <li>
          <details class="drawer__group">
            <summary>Servicii ${icon('chevron')}</summary>
            <ul class="drawer__sublist" role="list">
              ${SERVICES.map((s) => `<li><a class="drawer__sublink" href="${base}servicii/${s.slug}.html">${s.title}</a></li>`).join('\n              ')}
              <li><a class="drawer__sublink" href="${base}servicii.html"><strong>Toate serviciile</strong></a></li>
            </ul>
          </details>
        </li>
        <li><a class="drawer__link" href="${base}de-ce.html">De ce? ${icon('chevronR')}</a></li>
        <li><a class="drawer__link" href="${base}test-relationare.html">Test de relaționare ${icon('chevronR')}</a></li>
        <li><a class="drawer__link" href="${base}articole.html">Articole ${icon('chevronR')}</a></li>
        <li><a class="drawer__link" href="${base}contact.html">Contact ${icon('chevronR')}</a></li>
      </ul>
      <a class="btn btn--primary btn--block mt-4" href="${base}programare.html">Programează o ședință</a>
      <div class="footer__contact">
        <a href="tel:${SITE.phoneRaw}">${icon('phone')}${SITE.phone}</a>
        <a href="${waLink()}" target="_blank" rel="noopener">${icon('whatsapp')}WhatsApp</a>
        ${SITE.email ? `<a href="mailto:${SITE.email}">${icon('mail')}${SITE.email}</a>` : ''}
      </div>
    </div>
  </div>`;

const footer = (base) => `
  <footer class="site-footer no-print">
    <div class="container">
      <div class="footer__grid">
        <div>
          <a class="logo" href="${base}index.html">
            <span class="logo__mark">${mark()}</span>
            <span class="logo__text">
              <span class="logo__name">${SITE.name}</span>
              <span class="logo__sub">${SITE.practice}</span>
            </span>
          </a>
          <p class="fs-xs soft mt-4" style="max-width:34ch">Servicii profesionale de psihologie și psihoterapie, pentru adulți și cupluri. Ședințe în cabinet și online.</p>
          <div class="footer__contact">
            <a href="tel:${SITE.phoneRaw}">${icon('phone')}${SITE.phone}</a>
            <a href="${waLink()}" target="_blank" rel="noopener">${icon('whatsapp')}WhatsApp</a>
            ${SITE.email ? `<a href="mailto:${SITE.email}">${icon('mail')}${SITE.email}</a>` : ''}
            ${SITE.address ? `<a href="${base}contact.html">${icon('pin')}${SITE.address}</a>` : `<a href="${base}contact.html">${icon('pin')}Adresa cabinetului, în curând</a>`}
          </div>
        </div>

        <div>
          <p class="footer__title">Programează o ședință</p>
          <ul class="footer__list" role="list">
            <li><a href="${base}programare.html?s=psihoterapie">Programare Psihoterapie</a></li>
            <li><a href="${base}programare.html?s=evaluare">Programare Evaluare Psihologică</a></li>
            <li><a href="${base}programare.html?s=consiliere">Programare Consiliere Psihologică</a></li>
            <li><a href="${base}programare.html?s=dezvoltare">Programare Dezvoltare personală</a></li>
            <li><a href="${base}programare.html?s=clinica">Programare Psihologie Clinică</a></li>
          </ul>
        </div>

        <div>
          <p class="footer__title">Servicii</p>
          <ul class="footer__list" role="list">
            ${SERVICES.map((s) => `<li><a href="${base}servicii/${s.slug}.html">${s.title}</a></li>`).join('\n            ')}
          </ul>
        </div>

        <div>
          <p class="footer__title">Legal</p>
          <ul class="footer__list" role="list">
            <li><a href="${base}legal.html#termeni">Termeni și condiții</a></li>
            <li><a href="${base}legal.html#responsabilitati">Responsabilități și limite profesionale</a></li>
            <li><a href="${base}legal.html#anulare">Politică de anulare/reprogramare</a></li>
            <li><a href="${base}legal.html#confidentialitate">Politică de confidențialitate</a></li>
            <li><a href="${base}legal.html#rambursari">Politică de rambursări</a></li>
            <li><a href="${base}legal.html#cookies">Politică Cookies</a></li>
            <li><a href="${base}contact.html">Contact</a></li>
          </ul>
        </div>
      </div>

      <div class="callout mt-8" style="max-width:none">
        ${icon('shield')}
        <p><b>Plăți și siguranță.</b> Plățile sunt procesate securizat prin Stripe. Acceptăm Visa și Mastercard. Nu stocăm date de card pe acest site.</p>
      </div>

      <div class="footer__bottom">
        <p>Toate drepturile rezervate. © 2026 ${SITE.practice} ${SITE.name}.</p>
        <div class="paylogos">
          <a class="paylogo" href="https://stripe.com" target="_blank" rel="noopener nofollow">Stripe</a>
          <a class="paylogo" href="https://www.visa.com" target="_blank" rel="noopener nofollow">Visa</a>
          <a class="paylogo" href="https://www.mastercard.com" target="_blank" rel="noopener nofollow">Mastercard</a>
          <a class="paylogo" href="https://anpc.ro" target="_blank" rel="noopener nofollow">ANPC</a>
          <a class="paylogo" href="https://reclamatiisal.anpc.ro/" target="_blank" rel="noopener nofollow">SAL ANPC</a>
          <a class="paylogo" href="https://infocons.ro" target="_blank" rel="noopener nofollow">InfoCons</a>
        </div>
      </div>
    </div>
  </footer>

  <nav class="mobile-bar no-print" data-mobile-bar aria-label="Acțiuni rapide">
    <div class="mobile-bar__dock">
      <a class="mobile-bar__icon" href="tel:${SITE.phoneRaw}" aria-label="Sună la ${SITE.phone}">${icon('phone')}</a>
      <a class="mobile-bar__icon" href="${waLink()}" target="_blank" rel="noopener" aria-label="Scrie pe WhatsApp">${icon('whatsapp')}</a>
      <span class="mobile-bar__sep" aria-hidden="true"></span>
      <a class="mobile-bar__cta" href="${base}programare.html">Programare</a>
    </div>
  </nav>

  <button class="fab no-print" type="button" data-to-top aria-label="Înapoi sus">${icon('up')}</button>

  <aside class="cookie no-print" data-cookie data-open="false" role="region" aria-label="Preferințe cookie">
    <h2>Cookie-uri, pe scurt</h2>
    <p>Folosim cookie‑uri pentru a îmbunătăți experiența ta pe site. Navigând pe acest site, ești de acord cu utilizarea cookie‑urilor. Poți alege doar strictul necesar.</p>
    <div class="cookie__actions">
      <button class="btn btn--primary btn--sm" type="button" data-cookie-accept>Accept toate</button>
      <button class="btn btn--ghost btn--sm" type="button" data-cookie-essential>Doar esențiale</button>
      <a class="btn btn--quiet btn--sm" href="${base}legal.html#cookies">Politica Cookies</a>
    </div>
  </aside>

  <dialog class="palette" data-palette aria-label="Căutare rapidă">
    <div class="palette__search">
      ${icon('search')}
      <input class="palette__input" type="search" data-palette-input placeholder="Caută servicii, pagini, instrumente…" aria-label="Caută" autocomplete="off">
      <kbd class="kbd">Esc</kbd>
    </div>
    <div class="palette__results" data-palette-results></div>
    <div class="palette__foot">
      <span><kbd class="kbd">↑</kbd> <kbd class="kbd">↓</kbd> navighează</span>
      <span><kbd class="kbd">↵</kbd> deschide</span>
      <span style="margin-inline-start:auto">${SITE.name}</span>
    </div>
  </dialog>`;

/* --------------------------------------------------------------------------
   Layout
   -------------------------------------------------------------------------- */
function layout({ title, desc, active, base = '', content, schema = '', canonical }) {
  const t = `${title} · ${SITE.name}`;
  /* Absolute URLs only make sense once the domain is known. */
  const abs = (p = '') => (SITE.origin ? `${SITE.origin}/${p}` : '');
  return `<!doctype html>
<html lang="ro" data-base="${base}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${t}</title>
<meta name="description" content="${desc}">
<meta name="author" content="${SITE.name} — ${SITE.practice}">
<meta name="theme-color" content="#F7F9FC" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#08101B" media="(prefers-color-scheme: dark)">
${SITE.origin ? `<link rel="canonical" href="${abs(canonical || '')}">` : ''}

<meta property="og:type" content="website">
<meta property="og:locale" content="ro_RO">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${desc}">
${SITE.origin ? `<meta property="og:url" content="${abs(canonical || '')}">
<meta property="og:image" content="${abs('assets/img/og.svg')}">` : ''}
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="${base}assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${base}assets/img/favicon.svg">
<link rel="manifest" href="${base}manifest.webmanifest">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,300..800&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:ital,wght@0,300..700;1,300..700&display=swap">
<link rel="stylesheet" href="${base}assets/css/main.css">
<link rel="stylesheet" href="${base}assets/css/ui.css">

<script>
  /* Contact details for the scripted flows (booking hand-off, palette, ICS).
     Single source of truth lives in _build/build.js — never hard-code here. */
  window.EP = ${JSON.stringify({
    person: SITE.person,
    phone: SITE.phone,
    phoneRaw: SITE.phoneRaw,
    wa: SITE.wa,
    email: SITE.email,
    address: SITE.address
  })};

  /* Theme applied before first paint — no flash of the wrong palette. */
  (function () {
    try {
      var t = localStorage.getItem('ep-theme');
      if (t) document.documentElement.dataset.theme = t;
    } catch (e) {}
  })();
</script>
<noscript><style>[data-reveal]{opacity:1!important;transform:none!important}.no-js-hide{display:none}</style></noscript>
${schema}
</head>
<body>
<div class="shell">
${header(base, active)}

<main id="main">
${content}
</main>

${footer(base)}
</div>
<script src="${base}assets/js/app.js" defer></script>
</body>
</html>
`;
}

/* --------------------------------------------------------------------------
   Schema.org
   -------------------------------------------------------------------------- */
const schemaLD = (obj) => `<script type="application/ld+json">${JSON.stringify(obj, null, 2)}</script>`;

/* Only emit fields we actually know — an empty or invented value in
   structured data is worse than an absent one. */
const prune = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined));

const orgSchema = schemaLD(prune({
  '@context': 'https://schema.org',
  '@type': ['Psychologist', 'LocalBusiness'],
  name: `${SITE.practice} ${SITE.name}`,
  description: 'Cabinet de psihologie. Psihoterapie cognitiv-comportamentală, evaluare psihologică clinică, consiliere, terapie de cuplu și individuală, în cabinet sau online.',
  url: SITE.origin,
  telephone: SITE.phoneRaw,
  email: SITE.email,
  priceRange: '$$',
  knowsLanguage: 'ro',
  openingHoursSpecification: [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: '09:00', closes: '21:00'
  }],
  areaServed: 'România',
  availableService: SERVICES.map((s) => ({ '@type': 'MedicalTherapy', name: s.title }))
}));

/* --------------------------------------------------------------------------
   Service detail template — one data-driven page per service.
   -------------------------------------------------------------------------- */
function servicePage(s) {
  const others = SERVICES.filter((o) => o.slug !== s.slug).slice(0, 3);
  return `
  <section class="page-head">
    <div class="rings page-head__rings" aria-hidden="true">
      <svg viewBox="0 0 200 200"><circle class="r1" cx="100" cy="100" r="40" pathLength="100"/><circle class="r2" cx="100" cy="100" r="60" pathLength="100"/><circle class="r3" cx="100" cy="100" r="80" pathLength="100"/><circle class="r4" cx="100" cy="100" r="98" pathLength="100"/></svg>
    </div>
    <div class="container page-head__inner">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="../index.html">Acasă</a>${icon('chevronR')}
        <a href="../servicii.html">Servicii</a>${icon('chevronR')}
        <span aria-current="page">${s.title}</span>
      </nav>
      <p class="eyebrow mt-5">${s.sub}</p>
      <h1>${s.title}</h1>
      <p class="lede">${s.lede}</p>
      <div class="cluster mt-6">
        <a class="btn btn--primary" href="../programare.html?s=${s.slug}">Programează o ședință ${icon('arrow', 'btn__icon btn__icon--arrow')}</a>
        <a class="btn btn--ghost" href="../contact.html">Am o întrebare</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="rail">
        <aside class="rail__aside">
          <p class="eyebrow eyebrow--bare">Pe scurt</p>
          <dl class="spec mt-5">
            <div class="spec__row"><dt>Durată</dt><dd>${s.duration}</dd></div>
            <div class="spec__row"><dt>Format</dt><dd>${s.format}</dd></div>
            <div class="spec__row"><dt>Rezultat</dt><dd>${s.outcome}</dd></div>
            <div class="spec__row"><dt>Abordare</dt><dd>Cognitiv-comportamentală</dd></div>
          </dl>
          <a class="btn btn--ghost btn--sm btn--block mt-6" href="../programare.html?s=${s.slug}">Verifică disponibilitatea</a>
        </aside>

        <div>
          <div class="body-copy" data-reveal>
            <p class="fs-lg display" style="line-height:1.4">${s.short}</p>

            <h2>Pentru cine este</h2>
            <ul>
              ${s.for.map((f) => `<li>${f}</li>`).join('\n              ')}
            </ul>

            <h2>Cum lucrăm</h2>
            <p>Primul pas este întotdeauna același: o discuție în care înțeleg unde ești acum și ce ți-ai dori să fie diferit. De acolo construim un plan cu obiective verificabile, nu cu promisiuni vagi.</p>
            <p>Între ședințe primești exerciții scurte și concrete. Terapia cognitiv-comportamentală funcționează pentru că schimbarea se întâmplă în viața de zi cu zi, nu doar în cele cincizeci de minute din cabinet.</p>

            <blockquote>Timpul și resursele tale contează. De aceea fiecare proces începe cu obiective clare și cu o estimare onestă a drumului până acolo — fără ocolișuri, pas cu pas.</blockquote>
          </div>

          <div class="steps steps--rule mt-9" data-reveal-group>
            <div class="step" data-reveal><h3>Contact</h3><p>Îmi scrii sau alegi direct un interval liber în calendar.</p></div>
            <div class="step" data-reveal><h3>Prima ședință</h3><p>Clarificăm situația și stabilim obiectivele.</p></div>
            <div class="step" data-reveal><h3>Planul</h3><p>Primești o structură clară, cu pași și repere.</p></div>
            <div class="step" data-reveal><h3>Lucrul propriu-zis</h3><p>Ședințe periodice, cu evaluarea progresului.</p></div>
          </div>

          <div class="callout mt-8">
            ${icon('video')}
            <p><b>Disponibil și online.</b> Aceeași ședință, prin Google Meet, cu aceeași confidențialitate. Primești linkul în emailul de confirmare.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section section--sunken">
    <div class="container">
      <div class="sec-head">
        <div class="sec-head__top">
          <div>
            <p class="eyebrow">Continuă</p>
            <h2>Alte servicii</h2>
          </div>
          <a class="link" href="../servicii.html">Toate serviciile ${icon('arrow')}</a>
        </div>
      </div>
      <div class="grid grid--3" data-reveal-group>
        ${others.map((o) => `<article class="card svc-card" data-reveal>
          <span class="card__icon">${icon(o.icon)}</span>
          <h3 class="card__title"><a href="${o.slug}.html">${o.title}</a></h3>
          <p class="card__text">${o.sub}</p>
          <div class="card__foot"><span>Vezi detalii</span><span class="card__arrow">${icon('arrow')}</span></div>
        </article>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="section section--flush-top">
    <div class="container">
      <div class="cta-band">
        <div class="rings cta-band__rings" aria-hidden="true">
          <svg viewBox="0 0 200 200"><circle class="r1" cx="100" cy="100" r="40" pathLength="100"/><circle class="r2" cx="100" cy="100" r="62" pathLength="100"/><circle class="r3" cx="100" cy="100" r="82" pathLength="100"/><circle class="r4" cx="100" cy="100" r="99" pathLength="100"/></svg>
        </div>
        <p class="eyebrow eyebrow--accent">${s.sub}</p>
        <h2 class="mt-4" style="max-width:18ch">Primul pas este cel mai greu. Restul îl facem împreună.</h2>
        <div class="cluster mt-6">
          <a class="btn btn--inverse btn--lg" href="../programare.html?s=${s.slug}">Programează ${s.title.toLowerCase()} ${icon('arrow', 'btn__icon btn__icon--arrow')}</a>
          <a class="btn btn--ghost btn--lg" href="tel:${SITE.phoneRaw}">${icon('phone', 'btn__icon')} ${SITE.phone}</a>
        </div>
      </div>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------------
   Build
   -------------------------------------------------------------------------- */
const read = (f) => fs.readFileSync(path.join(PAGES, f), 'utf8');
const write = (rel, html) => {
  const out = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, 'utf8');
  console.log('  ✓', rel, `(${(html.length / 1024).toFixed(1)} kB)`);
};

/* Expose helpers to page fragments through a tiny mustache-ish pass. */
function expand(src, base) {
  return src
    .replace(/\{\{icon:([a-zA-Z]+)(?::([^}]+))?\}\}/g, (_, name, cls) => icon(name, cls || ''))
    .replace(/\{\{base\}\}/g, base)
    .replace(/\{\{person\}\}/g, SITE.person)
    .replace(/\{\{phone\}\}/g, SITE.phone)
    .replace(/\{\{phoneRaw\}\}/g, SITE.phoneRaw)
    .replace(/\{\{wa\}\}/g, waLink())
    .replace(/\{\{email\}\}/g, SITE.email)
    .replace(/\{\{address\}\}/g, SITE.address)
    .replace(/\{\{hours\}\}/g, SITE.hours)
    .replace(/\{\{services\}\}/g, () => SERVICES.map((s, i) => `
        <article class="card svc-card" data-reveal style="--i-color:${i % 2 ? 'var(--accent)' : 'var(--brand)'}">
          <span class="card__icon">${icon(s.icon)}</span>
          <p class="card__num">S/${String(i + 1).padStart(2, '0')}</p>
          <h3 class="card__title"><a href="${base}servicii/${s.slug}.html">${s.title}</a></h3>
          <p class="card__text">${s.short}</p>
          <div class="card__foot"><span>${s.duration} · ${s.format}</span><span class="card__arrow">${icon('arrow')}</span></div>
        </article>`).join('\n'))
    .replace(/\{\{serviceOptions\}\}/g, () => SERVICES.map((s) => `
            <button class="option" type="button" data-service="${s.slug}" aria-pressed="false">
              <span class="option__icon">${icon(s.icon)}</span>
              <span><b>${s.title}</b><span>${s.duration}</span></span>
              <span class="option__check">${icon('check')}</span>
            </button>`).join('\n'));
}

const PAGE_DEFS = [
  { file: 'index.html', out: 'index.html', title: 'Acasă', active: 'acasa', canonical: '', desc: 'Cabinet de psihologie — psihoterapie cognitiv-comportamentală, în cabinet și online. Evaluare psihologică, consiliere, terapie de cuplu și individuală.', schema: orgSchema },
  { file: 'despre-mine.html', out: 'despre-mine.html', title: 'Despre mine', active: 'despre', canonical: 'despre-mine/', desc: 'Cabinet de psihologie pentru adulți și cupluri. Arii de competență, cadrul ședințelor și modul în care lucrez.' },
  { file: 'servicii.html', out: 'servicii.html', title: 'Servicii', active: 'servicii', canonical: 'servicii/', desc: 'Evaluare psihologică, consiliere, terapie depresie-anxietate, terapie de cuplu, terapie individuală și dezvoltare personală — în cabinet sau online.' },
  { file: 'de-ce.html', out: 'de-ce.html', title: 'De ce?', active: 'de-ce', canonical: 'de-ce/', desc: 'Zece semne că ar fi util să consulți un terapeut, ce este psihoterapia și când merită să faci primul pas.' },
  { file: 'programare.html', out: 'programare.html', title: 'Programare', active: 'programare', canonical: 'programeaza-o-sedinta/', desc: 'Alegi serviciul, selectezi data și ora disponibilă, apoi finalizezi rezervarea. Ședințe în cabinet sau online.' },
  { file: 'contact.html', out: 'contact.html', title: 'Contact', active: 'contact', canonical: 'contact/', desc: 'Telefon, WhatsApp și formular de contact. Ședințe în cabinet și online.' },
  { file: 'articole.html', out: 'articole.html', title: 'Articole', active: 'articole', canonical: 'categorie/articole/', desc: 'Articole despre somn, anxietate, depresie și relații, scrise pe înțelesul tuturor.' },
  { file: 'test-relationare.html', out: 'test-relationare.html', title: 'Test de relaționare în cuplu', active: '', canonical: 'test-de-relationare/', desc: 'Test de personalitate pentru identificarea tiparului de relaționare în cuplu, plus un check-in emoțional de două minute.' },
  { file: 'legal.html', out: 'legal.html', title: 'Documente legale', active: '', canonical: 'legal/', desc: 'Termeni și condiții, confidențialitate, politica de anulare, rambursări și cookies.' }
];

console.log(`\n  ${SITE.name} · build\n`);

PAGE_DEFS.forEach((p) => {
  const content = expand(read(p.file), '');
  write(p.out, layout({
    title: p.title, desc: p.desc, active: p.active, base: '',
    content, schema: p.schema || '', canonical: p.canonical
  }));
});

SERVICES.forEach((s) => {
  write(`servicii/${s.slug}.html`, layout({
    title: s.title,
    desc: s.short.slice(0, 155),
    active: 'servicii',
    base: '../',
    canonical: `servicii/${s.slug}/`,
    content: servicePage(s),
    schema: schemaLD({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: s.title,
      serviceType: s.sub,
      description: s.short,
      provider: { '@type': 'Psychologist', name: `${SITE.practice} ${SITE.name}`, url: SITE.origin },
      areaServed: 'România',
      availableChannel: [
        { '@type': 'ServiceChannel', name: 'În cabinet', servicePhone: SITE.phoneRaw },
        { '@type': 'ServiceChannel', name: 'Online', serviceUrl: `${SITE.origin}/programare.html` }
      ]
    })
  }));
});

/* Sitemap + robots. A sitemap needs absolute URLs, so it is only written once
   SITE.origin is known; until then a stale one would be worse than none. */
const urls = [
  '', 'despre-mine.html', 'servicii.html', 'de-ce.html', 'programare.html',
  'contact.html', 'articole.html', 'test-relationare.html', 'legal.html',
  ...SERVICES.map((s) => `servicii/${s.slug}.html`)
];

if (SITE.origin) {
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE.origin}/${u}</loc><changefreq>monthly</changefreq><priority>${u === '' ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>
`);
} else {
  const stale = path.join(ROOT, 'sitemap.xml');
  if (fs.existsSync(stale)) { fs.unlinkSync(stale); console.log('  – sitemap.xml (omis: SITE.origin necompletat)'); }
}

write('robots.txt', `User-agent: *
Allow: /
${SITE.origin ? `\nSitemap: ${SITE.origin}/sitemap.xml\n` : ''}`);

console.log('\n  Gata.\n');
