# Meridian — șablon de site pentru cabinet de psihologie

Site static pentru un cabinet de psihologie, scris de la zero în HTML/CSS/JS pur.
Zero dependențe, zero build obligatoriu la runtime: fișierele `.html` din rădăcină *sunt*
site-ul și pot fi urcate direct pe orice hosting.

> **Notă despre conținut.** „Meridian" este o marcă-substituent. Site-ul nu conține numele,
> biografia, acreditările sau datele de contact ale vreunei persoane reale — toate textele
> sunt copy de șablon, scrise ca punct de plecare. Vezi secțiunea 6 pentru ce se completează
> înainte de lansare.

---

## 1. Rulare locală

```bash
node _build/serve.js
```

Apoi deschide <http://localhost:4173>. Serverul e un fișier de 46 de linii, fără npm install.

## 2. Regenerare după modificări de conținut

```bash
node _build/build.js
```

Verificarea linkurilor interne (rulează după fiecare build):

```bash
node _build/check.js
```

---

## 3. Structura

```
.
├─ index.html  despre-mine.html  servicii.html  de-ce.html
├─ programare.html  contact.html  articole.html
├─ test-relationare.html  legal.html
├─ servicii/                 ← 6 pagini generate din date
├─ assets/
│  ├─ css/fonts.css          ← @font-face pentru fonturile locale
│  ├─ css/main.css           ← tokens, reset, bază, layout, utilitare, fundal
│  ├─ css/ui.css             ← componente + stiluri de pagină
│  ├─ js/app.js              ← toate modulele de interacțiune
│  ├─ fonts/                 ← DM Sans și Manrope, găzduite local
│  └─ img/                   ← portret, favicon, imagine OG (SVG)
├─ _build/
│  ├─ build.js               ← generatorul (chrome-ul comun + datele serviciilor)
│  ├─ pages/*.html           ← conținutul fiecărei pagini, fără header/footer
│  ├─ serve.js  check.js
├─ manifest.webmanifest  robots.txt
```

**Unde editezi ce:**

| Vrei să schimbi | Fișier |
|---|---|
| Marcă, telefon, WhatsApp, email, adresă, domeniu | obiectul `SITE` din `_build/build.js` |
| Textul unei pagini | `_build/pages/<pagina>.html`, apoi `node _build/build.js` |
| Un serviciu (titlu, durată, descriere) | tabloul `SERVICES` din `_build/build.js` |
| Meniu, footer | `NAV`, `header()`, `footer()` din `_build/build.js` |
| Culori, tipografie, spațiere | blocul `@layer tokens` din `assets/css/main.css` |
| Comportament | `assets/js/app.js` |

Substituenți disponibili în fragmentele din `_build/pages/`:
`{{icon:nume}}`, `{{person}}`, `{{phone}}`, `{{phoneRaw}}`, `{{wa}}`, `{{email}}`,
`{{address}}`, `{{hours}}`, `{{services}}`, `{{serviceOptions}}`.

### Datele de contact — o singură sursă

Totul pleacă din `SITE` (`_build/build.js`). Aceleași valori ajung și în JavaScript, printr-un
`window.EP` injectat în `<head>`, deci nu există niciun număr de telefon scris de mână în
`app.js`.

`email`, `address` și `origin` sunt momentan **goale, intenționat**. Fiecare șablon se
degradează elegant fără ele:

- topbar-ul și footerul afișează telefon + WhatsApp, fără rând de email;
- pagina de contact spune explicit că adresa și emailul se adaugă în curând;
- formularul de contact și cererea de programare se trimit **pe WhatsApp**; în clipa în
  care completezi `SITE.email`, aceleași butoane trec automat pe `mailto:`;
- `canonical`, `og:url` și `sitemap.xml` sunt omise cât timp `origin` e gol — un sitemap cu
  URL-uri inventate ar fi mai rău decât niciunul.

---

## 4. Sistemul de design

**Format.** Layout editorial: etichete de secțiune numerotate (`01 / Servicii`), titluri mari
cu a doua parte accentuată, liste de servicii care se deschid pe loc pe fundal teal închis,
benzi de culoare între secțiuni, colțuri aproape drepte cu un singur colț tăiat mare.

**Primul ecran.** Pe pagina principală, bara de sus, header-ul, hero-ul și banda de sub el ocupă
exact un ecran (`.hero-screen`, `100svh`). Textul și spațiile din hero urmează și înălțimea, nu
doar lățimea. Înălțimea e una minimă, nu fixă: pe un ecran extrem de mic, textul împinge banda în
jos în loc să fie tăiat.

**Fără emoji.** Pictogramele sunt toate SVG, deci un telefon nu le poate înlocui cu emoji colorate.
Singurul caracter care ar putea fi afișat ca emoji, `©`, e forțat la varianta de text (`U+FE0E`),
iar `font-variant-emoji: text` din `main.css` e o protecție în plus. Pentru un simbol nou, folosește
`{{icon:nume}}`, nu un caracter Unicode.

**Tipografie.** Manrope pentru titluri, DM Sans pentru text și etichete, ambele găzduite local
în `assets/fonts/`, fără request-uri către terți. Accentul din `h1` este o linie portocalie
trasă sub cuvinte, cel din `h2` o culoare.

**Culoare.** Teal închis (`#0C3F40`) și portocaliu (`#FF7953`) peste hârtie (`#F6F6F0`) și
salvie (`#E8EEE6`). Pe suprafețe deschise, textul accentuat folosește o variantă ruginie
(`#B94B2D`), pentru contrast. Tema întunecată e reiluminată, nu inversată, și se activează
doar din butonul din header; site-ul se deschide luminos pentru toată lumea.

**Fundal.** Un ornament de linii și puncte, strict decorativ (`--pat-tile` în `main.css`).
Tile-ul e oglindit pe ambele axe și ancorat în centrul paginii, deci tot câmpul rămâne simetric
la orice lățime. E complet pe margini și translucid în mijloc (`--pat-fade`), ca să rămână vizibil
fără să concureze cu textul. E o mască, nu o imagine: culoarea vine din `--pat-color`, așa că aceeași figură funcționează pe
hârtie, pe salvie și pe teal. Intensitatea se reglează din `--pat-opacity`, densitatea din
`--pat-size`.

**Motiv grafic.** Un tesseract care se rotește — în capetele de pagină, în benzile de CTA
și în secțiunea despre cabinet. 16 vârfuri, 32 de muchii, proiectate 4D → 3D → 2D prin două
împărțiri de perspectivă (`Tesseract` din `app.js`). Toate muchiile rămân desenate; adâncimea
schimbă doar cât de tare se citește fiecare. Build-ul scrie în markup o poziție fixă, deci
figura e completă și fără JavaScript.

**Mișcare.** Tranziții scurte și apariții discrete la scroll. Totul respectă
`prefers-reduced-motion`. Tranziții între documente (`@view-transition`) unde browserul le
suportă.

**Straturi CSS.** `@layer tokens, reset, base, layout, components, pages, utilities` —
specificitate previzibilă, fără `!important` împrăștiat.

---

## 5. Feature-uri

**Programare în 4 pași** — serviciu → calendar → date → confirmare. Calendar propriu
(duminica închis, sloturi, validare), export `.ics`, trimitere pe WhatsApp sau email.
Deep-link: `programare.html?s=terapie-de-cuplu` preselectează serviciul.

**Instrumente gratuite** — test de relaționare în cuplu (8 întrebări, 4 tipare de atașament),
check-in emoțional (6 întrebări, recomandare de serviciu), exercițiu de respirație 4-7-8.
Toate marcate explicit ca instrumente de reflecție, nu diagnostic.

**Paletă de comandă** (`Ctrl`/`⌘` + `K`, sau `/`) — căutare pe tot site-ul, cu normalizare de
diacritice: „relatie" găsește „relaționare".

**Interfață** — temă întunecată/luminoasă salvată local și aplicată înainte de primul paint;
mega-meniu pentru servicii; drawer mobil cu focus trap; bară de progres la scroll; cuprins
care se activează la scroll; carusel de citate cu indicator de poziție; notificări discrete;
copiere în clipboard; cookie banner cu opțiune reală „doar esențiale".

**Bandă în mișcare** — banda de sub hero rulează continuu spre stânga (`Marquee` din `app.js`),
cu aceeași viteză pe orice ecran, și se oprește la hover. Conținutul e o singură dată în markup;
copia care închide bucla e adăugată din JavaScript și ascunsă cititoarelor de ecran. Cu
`prefers-reduced-motion` sau fără JavaScript, banda stă pe loc și se poate derula manual.

**Bară mobilă** — pe ecrane sub 768px, o bară flotantă: două butoane-iconiță pentru telefon
și WhatsApp, plus un buton portocaliu „Programare". Se retrage la scroll în jos și reapare la
scroll în sus, ca să nu concureze cu conținutul. Pe pagina principală așteaptă să treci de primul
ecran, ca să nu acopere banda.

**Tehnic** — Schema.org (`Psychologist` + `LocalBusiness`, `Service` pe fiecare serviciu, cu
câmpurile necunoscute omise, nu inventate); OpenGraph; manifest PWA cu shortcut-uri;
accesibilitate (skip link, `:focus-visible`, ARIA, un singur `h1`/pagină, `alt` peste tot).

**Robustețe** — dacă JS-ul cade sau `IntersectionObserver` / `requestAnimationFrame` nu
livrează, conținutul rămâne vizibil și cifrele animate afișează valoarea finală
(`<noscript>` + timeout-uri de siguranță). 1018 linkuri interne verificate automat, 0 rupte.

---

## 6. Ce trebuie completat înainte de orice utilizare publică

1. **Email, adresă și domeniu.** Completează `SITE.email`, `SITE.address` și `SITE.origin` în
   `_build/build.js` și rulează build-ul. Restul se rescrie singur, inclusiv sitemap-ul.
2. **Numele, biografia și acreditările.** Site-ul rulează pe o marcă-substituent
   („Meridian") și nu conține nicio afirmație despre o persoană anume. Completează numele
   real în `SITE`, apoi scrie biografia în `_build/pages/despre-mine.html` și lista de
   acreditări din cardul *Arii de competență* — acolo unde acum sunt doar domenii de lucru.
3. **Fotografia de portret.** `assets/img/portrait.svg` este o ilustrație substituent.
   Înlocuiește-o cu o fotografie reală (JPG/WebP, ~800×1000) și schimbă `src` în
   `_build/pages/index.html` și `despre-mine.html`. În hero, rama se întinde pe toată
   înălțimea coloanei de text și decupează `cover`, cu un colț tăiat mare — alege o poză cu
   subiectul centrat și cu spațiu liber în lateral, ca decupajul să nu taie umerii. Peste
   imagine stau textul de sus, ștampila rotundă și legenda, deci partea de sus și cea de jos a
   pozei trebuie să rămână liniștite. Reglajul fin se face din `object-position` pe
   `.hero-portrait` și pe `.portrait__frame img`.
4. **Programul de lucru** afișat (L–S 09:00–21:00, iar pe pagina de contact L–V 09:00–21:00 /
   S 10:00–16:00) este o presupunere. Confirmă-l sau modifică `SITE.hours` și
   `_build/pages/contact.html`.
5. **Textele juridice.** `legal.html` conține termeni, politici de anulare, rambursare,
   confidențialitate și cookies scrise ca model. Trebuie recitite și adaptate de titularul
   cabinetului înainte de publicare — sunt documente cu efect juridic.
6. **Harta.** Blocul de hartă de pe pagina de contact este momentan un substituent. Modulul
   `Map_` din `app.js` încarcă harta doar la cerere (fără request către terți până când
   vizitatorul apasă butonul) — reactivează-l adăugând înapoi `data-map` și `data-src`.
7. **Programarea reală.** Formularul compune acum un mesaj complet pe WhatsApp. Pentru
   rezervare cu plată în avans, punctul de integrare este funcția `submit()` din modulul
   `Booking` (`assets/js/app.js`), plus disponibilitatea reală în calendar (acum sloturile
   sunt generate determinist, ca demonstrație).
8. **Mențiunile despre plăți.** Textele care descriu procesarea prin Stripe și logourile
   ANPC / SAL / InfoCons trebuie păstrate doar dacă reflectă realitatea cabinetului.

---

## 7. Suport browser

Chrome / Edge / Firefox / Safari, ultimele două versiuni majore. Funcțiile moderne folosite
(`@layer`, `color-mix`, `@container`, `@view-transition`) degradează elegant: pe un browser
care nu le cunoaște, pagina rămâne complet lizibilă și utilizabilă.
