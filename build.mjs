/**
 * Build statik pa varesi — merr shabllonet nga src/ dhe tekstet nga src/i18n/,
 * dhe gjeneron HTML te plote per te dyja gjuhet ne dist/.
 *
 * Perse build-time dhe jo JS ne runtime: permbajtja duhet te jete ne HTML qe
 * ne ngarkim, perndryshe Google nuk e indekson — kritike per kerkime lokale
 * si "noter Shkoder".
 */
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const SRC = 'src';
const OUT = 'dist';

/** Ndrysho kur te regjistrohet domain-i final (shih brief seksioni 2). */
const SITE_URL = (process.env.SITE_URL || 'https://noteriaeurela.al').replace(/\/$/, '');

const LOCALES = ['sq', 'en'];
const DEFAULT_LOCALE = 'sq';

/** Rendi ketu percakton rendin e navigimit dhe te sitemap-it. */
const PAGES = [
  { id: 'home',      template: 'index.html',           priority: '1.0' },
  { id: 'services',  template: 'sherbimet.html',       priority: '0.9' },
  { id: 'documents', template: 'dokumentacioni.html',  priority: '0.8' },
  { id: 'about',     template: 'rreth-nesh.html',      priority: '0.7' },
  { id: 'contact',   template: 'kontakt.html',         priority: '0.9' },
];

// ---------------------------------------------------------------- templating

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Zgjidh nje shteg si "business.address.city" ne kontekst. */
function lookup(ctx, path) {
  if (path === '.') return ctx.__item !== undefined ? ctx.__item : ctx;
  let cur = ctx;
  for (const part of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Gjen {{/tag}} qe i perket nje {{#tag}} te hapur ne `from`, duke numeruar
 * blloqet e ndervendosura. Kthen indeksin e hapjes se mbylljes.
 */
function findClose(tpl, from, tag) {
  const re = new RegExp(`{{(#|\\/)${tag}(?:\\s+[\\w.]+)?\\s*}}`, 'g');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(tpl)) !== null) {
    depth += m[1] === '#' ? 1 : -1;
    if (depth === 0) return { start: m.index, end: re.lastIndex };
  }
  throw new Error(`Bllok i pambyllur: {{#${tag}}}`);
}

function renderBlocks(tpl, ctx) {
  const open = /{{#(each|if|unless)\s+([\w.]+)\s*}}/;
  let m;
  while ((m = open.exec(tpl)) !== null) {
    const [full, tag, path] = m;
    const bodyStart = m.index + full.length;
    const close = findClose(tpl, bodyStart, tag);
    const body = tpl.slice(bodyStart, close.start);
    const value = lookup(ctx, path);

    let out = '';
    if (tag === 'each') {
      const list = Array.isArray(value) ? value : [];
      out = list
        .map((item, i) => {
          const scope = typeof item === 'object' && item !== null
            ? { ...ctx, ...item, __item: item, '@index': i, '@number': i + 1 }
            : { ...ctx, __item: item, '@index': i, '@number': i + 1 };
          return renderVars(renderBlocks(body, scope), scope);
        })
        .join('');
    } else {
      const truthy = Array.isArray(value) ? value.length > 0 : Boolean(value);
      if (tag === 'if' ? truthy : !truthy) out = renderBlocks(body, ctx);
    }

    tpl = tpl.slice(0, m.index) + out + tpl.slice(close.end);
    open.lastIndex = 0;
  }
  return tpl;
}

function renderVars(tpl, ctx) {
  // {{{ raw }}} para {{ escaped }}, perndryshe e para do te hante te dytin
  return tpl
    .replace(/{{{\s*([\w.@]+)\s*}}}/g, (_, p) => {
      const v = lookup(ctx, p);
      return v == null ? '' : String(v);
    })
    .replace(/{{\s*([\w.@]+)\s*}}/g, (_, p) => {
      const v = lookup(ctx, p);
      if (v == null) {
        console.warn(`  ! variabel e panjohur: {{ ${p} }}`);
        return '';
      }
      return escapeHtml(v);
    });
}

async function loadPartials() {
  const dir = join(SRC, 'partials');
  if (!existsSync(dir)) return {};
  const out = {};
  for (const f of await readdir(dir)) {
    if (f.endsWith('.html')) out[f.replace(/\.html$/, '')] = await readFile(join(dir, f), 'utf8');
  }
  return out;
}

function inlinePartials(tpl, partials, depth = 0) {
  if (depth > 10) throw new Error('Partial-e rekursive (mbi 10 nivele)');
  const re = /{{>\s*([\w-]+)\s*}}/g;
  if (!re.test(tpl)) return tpl;
  return inlinePartials(
    tpl.replace(/{{>\s*([\w-]+)\s*}}/g, (_, name) => {
      if (!(name in partials)) throw new Error(`Partial mungon: ${name}`);
      return partials[name];
    }),
    partials,
    depth + 1
  );
}

const render = (tpl, ctx, partials) =>
  renderVars(renderBlocks(inlinePartials(tpl, partials), ctx), ctx);

// ---------------------------------------------------------------- output path

/** "/" -> dist/index.html ; "/en/services" -> dist/en/services/index.html */
const outputPathFor = (route) => {
  const clean = route.replace(/^\/|\/$/g, '');
  return clean ? join(OUT, clean, 'index.html') : join(OUT, 'index.html');
};

// ---------------------------------------------------------------- build

async function build() {
  const t0 = Date.now();
  // Ne dev, Tailwind shkruan dist/assets/css jashte ketij procesi; nje fshirje
  // e plote do ta hiqte ate skedar dhe watch-i nuk do ta rishkruante.
  if (!process.env.NO_CLEAN) await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const dicts = {};
  for (const l of LOCALES) dicts[l] = JSON.parse(await readFile(join(SRC, 'i18n', `${l}.json`), 'utf8'));

  const partials = await loadPartials();
  const layout = await readFile(join(SRC, 'layouts', 'base.html'), 'utf8');

  let count = 0;
  const sitemap = [];

  for (const locale of LOCALES) {
    const dict = dicts[locale];

    for (const page of PAGES) {
      const route = dict.routes[page.id];
      if (!route) throw new Error(`Mungon routes.${page.id} ne ${locale}.json`);

      // Lidhjet e te njejtes faqe ne gjuhet e tjera — per hreflang dhe switcher
      const alternates = LOCALES.map((l) => ({
        hreflang: l,
        href: SITE_URL + dicts[l].routes[page.id],
      }));
      const other = LOCALES.find((l) => l !== locale);

      const ctx = {
        ...dict,
        page: dict.pages[page.id],
        pageId: page.id,
        isHome: page.id === 'home',
        url: route,
        canonical: SITE_URL + route,
        siteUrl: SITE_URL,
        year: new Date().getFullYear(),
        alternates,
        defaultHref: SITE_URL + dicts[DEFAULT_LOCALE].routes[page.id],
        switcher: {
          href: dicts[other].routes[page.id],
          label: dicts[other].label,
          labelShort: dicts[other].labelShort,
          lang: other,
        },
        navItems: PAGES.map((p) => ({
          id: p.id,
          label: dict.nav[p.id],
          href: dict.routes[p.id],
          isActive: p.id === page.id,
        })),
      };

      const body = await readFile(join(SRC, 'pages', page.template), 'utf8');
      const html = render(layout, { ...ctx, content: render(body, ctx, partials) }, partials);

      const dest = outputPathFor(route);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, html, 'utf8');

      sitemap.push({ loc: SITE_URL + route, priority: page.priority, alternates });
      count++;
      console.log(`  ${locale}  ${route.padEnd(18)} -> ${dest}`);
    }
  }

  // asete + skedare statike
  if (existsSync(join(SRC, 'assets'))) await cp(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });
  if (existsSync('public')) await cp('public', OUT, { recursive: true });

  await writeFile(join(OUT, 'sitemap.xml'), buildSitemap(sitemap), 'utf8');
  await writeFile(
    join(OUT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    'utf8'
  );

  console.log(`\n  ${count} faqe + sitemap.xml + robots.txt ne ${Date.now() - t0}ms`);
}

const buildSitemap = (entries) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.loc}</loc>
${e.alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`).join('\n')}
    <priority>${e.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

build().catch((err) => {
  console.error(`\nBuild deshtoi: ${err.message}\n`);
  process.exit(1);
});
