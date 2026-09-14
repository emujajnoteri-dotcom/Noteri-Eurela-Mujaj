# Website — Zyra Noteriale Dr. Eurela Mujaj (Shkreli)

Site statik dygjuhësh (Shqip / Anglisht) për zyrën noteriale në Shkodër.
Pa framework, pa backend, pa bazë të dhënash — HTML i gjeneruar në build-time,
Tailwind CSS dhe pak JS vanilla.

## Nisja

```bash
npm install
npm run dev      # http://localhost:3000
```

| Komanda | Çfarë bën |
|---|---|
| `npm run dev` | Server lokal + rindërtim automatik kur ndryshon `src/` |
| `npm run build` | Gjeneron `dist/` të gatshëm për publikim |
| `npm run clean` | Fshin `dist/` |

## Struktura

```
src/
  i18n/sq.json        ← TË GJITHA tekstet shqip
  i18n/en.json        ← TË GJITHA tekstet anglisht
  layouts/base.html   ← shelli i faqes: <head>, SEO, JSON-LD
  partials/           ← header, footer
  pages/              ← 5 shabllonet e faqeve
  styles/main.css     ← Tailwind + tokenet e brandit (gold/zi)
  assets/js/main.js   ← menu mobile + dërgim formulari
public/               ← kopjohet ashtu siç është në dist/ (favicon)
build.mjs             ← gjeneratori statik
dist/                 ← output-i (i injoruar nga git)
```

### Ku ndryshohet teksti

Në `src/i18n/sq.json` dhe `src/i18n/en.json` — jo në HTML. Të dy skedarët
duhet të kenë të njëjtat çelësa; nëse një çelës mungon, build-i e paralajmëron
me `! variabel e panjohur`.

### Si funksionon i18n

Prefiks rruge: shqipja në rrënjë, anglishtja nën `/en/`. Sllagët janë të
pavarur për çdo gjuhë dhe përcaktohen te `routes` në JSON-in përkatës.

| SQ | EN |
|---|---|
| `/` | `/en` |
| `/sherbimet` | `/en/services` |
| `/dokumentacioni` | `/en/documents` |
| `/rreth-nesh` | `/en/about` |
| `/kontakt` | `/en/contact` |

Për të shtuar një faqe: shto shabllonin te `src/pages/`, çelësat te të dy
JSON-at (`routes`, `nav`, `pages`), dhe një rresht te `PAGES` në `build.mjs`.

Përmbajtja gjenerohet në build-time e jo me JS në runtime, që Google ta
indeksojë — thelbësore për kërkime lokale si "noter Shkodër".

## Publikimi

`netlify.toml` dhe `vercel.json` janë gati. Të dy hostet:
build `npm run build`, publiko dosjen `dist`.

Domain-i ende nuk është regjistruar. Kur të jetë, vendos variablin e mjedisit
`SITE_URL` te hosti (p.sh. `https://noteriaeurela.al`) — përdoret për
`canonical`, `hreflang` dhe `sitemap.xml`. Default-i është në `build.mjs`.

## E mbetur

- [ ] **Formspree** — krijo një form te https://formspree.io dhe zëvendëso
      `FORM_ENDPOINT` te `src/assets/js/main.js`. Deri atëherë formulari
      shfaq mesazhin e gabimit.
- [ ] **Logo** — `logo_reference.png` nga kartvizita; tani është placeholder
      tekstual me ikonë pendë te `src/partials/header.html` dhe `public/favicon.svg`.
- [ ] **Foto portret** — placeholder te `src/pages/rreth-nesh.html`.
      Fasada e zyrës është vendosur te ballina (`src/assets/img/zyra-fasade.jpg`).
- [ ] **Linku i Google Business** — `reviews.profileUrl` te të dy JSON-at është
      ende një URL kërkimi në Maps; zëvendësoje me linkun e profilit real.
- [ ] **Dokumentacioni** — lista për çdo shërbim, faza 2.
- [ ] **Doktoratura** — fusha/viti, nëse do specifikohet te "Rreth Noteres".

## Shënime përmbajtjeje

- **Çmimet nuk shfaqen** — kërkesë e klientes. CTA është "Na kontaktoni";
  arsyeja shpjegohet te shënimi i tarifave në faqen e shërbimeve.
- **Reviews** — `reviews.items` te të dy JSON-at, me fushat
  `{ emri, teksti, yje, data }`. Yjet nuk ruhen si ikona: `build.mjs` e kthen
  `yje` në një varg 5-elementësh të ndezur/fikur, që numri të mbetet e dhënë
  dhe jo prezantim.
- **AggregateRating** — markup-i është te ballina, brenda objektit `Notary`.
  Google **nuk** i shfaq yjet për vlerësime të vetë-shërbyera (një biznes që
  publikon review-t e veta në faqen e vet), ndaj mos prit yje në rezultatet e
  kërkimit prej këtij markup-i. Yjet vijnë nga profili i Google Business.
- **WhatsApp** — numri merret nga `business.phone`; `business.whatsappUrl`
  gjenerohet me mesazh të parambushur. Shfaqet si buton pezull në çdo faqe,
  te faqja e kontaktit, te footer-i dhe te CTA e ballinës.
- **Eksperienca** shkruhet "mbi 9 vite" ose "që prej 2017" — jo "10 vite",
  për saktësi kundrejt regjistrimit në QKB (17/01/2017).
