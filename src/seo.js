// Server-side SEO: the React app is a single page, so search engines and WhatsApp/Facebook
// previews would see an empty page. This injects real <title>, meta, Open Graph and JSON-LD
// into index.html for every public URL before it is sent.
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { Book } = require('./models');
const { getSettings, getAuthor } = require('./routes/public');
const { esc } = require('./util');

const abs = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : `${config.siteUrl}${u.startsWith('/') ? '' : '/'}${u}`);
const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t;
};

function headTags({ title, description, keywords, image, url, type = 'website', noindex, jsonLd, settings }) {
  const t = [];
  t.push(`<title>${esc(title)}</title>`);
  if (description) t.push(`<meta name="description" content="${esc(description)}">`);
  if (keywords) t.push(`<meta name="keywords" content="${esc(keywords)}">`);
  t.push(`<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'}">`);
  t.push(`<link rel="canonical" href="${esc(url)}">`);
  t.push(`<meta property="og:site_name" content="${esc(settings.siteName)}">`);
  t.push(`<meta property="og:type" content="${type}">`);
  t.push(`<meta property="og:title" content="${esc(title)}">`);
  if (description) t.push(`<meta property="og:description" content="${esc(description)}">`);
  t.push(`<meta property="og:url" content="${esc(url)}">`);
  if (image) t.push(`<meta property="og:image" content="${esc(image)}">`);
  t.push(`<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`);
  t.push(`<meta name="twitter:title" content="${esc(title)}">`);
  if (description) t.push(`<meta name="twitter:description" content="${esc(description)}">`);
  if (image) t.push(`<meta name="twitter:image" content="${esc(image)}">`);
  if (settings.twitterHandle) t.push(`<meta name="twitter:site" content="${esc(settings.twitterHandle)}">`);
  if (settings.googleVerification) t.push(`<meta name="google-site-verification" content="${esc(settings.googleVerification)}">`);
  if (settings.bingVerification) t.push(`<meta name="msvalidate.01" content="${esc(settings.bingVerification)}">`);
  if (jsonLd) t.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`);
  if (settings.gaId && /^[A-Za-z0-9-]+$/.test(settings.gaId)) {
    t.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${settings.gaId}"></script>`);
    t.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${settings.gaId}');</script>`);
  }
  return t.join('\n    ');
}

async function metaFor(pathname) {
  const settings = (await getSettings()).toObject();
  const author = (await getAuthor()).toObject();
  const fallbackImg = abs(settings.defaultOgImage);
  const base = { settings, url: `${config.siteUrl}${pathname === '/' ? '/' : pathname}` };
  const authorName = author.name || settings.siteName;

  if (pathname === '/' || pathname === '') {
    const s = settings.homeSeo || {};
    return {
      status: 200,
      tags: headTags({
        ...base,
        title: s.metaTitle || `${settings.siteName} – ${settings.homeHeading}`,
        description: s.metaDescription || settings.homeSubheading,
        keywords: s.keywords,
        image: abs(s.ogImage) || fallbackImg,
        noindex: s.noindex,
        jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: settings.siteName, url: config.siteUrl },
      }),
    };
  }

  if (pathname === '/about') {
    const s = author.seo || {};
    const same = Object.values(author.socials || {}).filter(Boolean);
    return {
      status: 200,
      tags: headTags({
        ...base,
        title: s.metaTitle || `About ${authorName} | ${settings.siteName}`,
        description: s.metaDescription || clip(author.bio || author.tagline, 160),
        keywords: s.keywords,
        image: abs(s.ogImage) || abs(author.photo) || fallbackImg,
        type: 'profile',
        noindex: s.noindex,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: authorName,
          description: clip(author.bio, 300),
          image: abs(author.photo) || undefined,
          jobTitle: author.tagline || undefined,
          sameAs: same.length ? same : undefined,
        },
      }),
    };
  }

  const m = pathname.match(/^\/books\/([^/]+)$/);
  if (m) {
    const book = await Book.findOne({ slug: decodeURIComponent(m[1]), published: true }).lean();
    if (!book) {
      const moved = await Book.findOne({ oldSlugs: decodeURIComponent(m[1]), published: true }).select('slug').lean();
      if (moved) return { redirect: `/books/${encodeURIComponent(moved.slug)}` };
      return { status: 404, tags: headTags({ ...base, title: `Page not found | ${settings.siteName}`, noindex: true }) };
    }
    const s = book.seo || {};
    const img = abs(s.ogImage) || abs(book.cover) || fallbackImg;
    return {
      status: 200,
      tags: headTags({
        ...base,
        title: s.metaTitle || `${book.title}${book.subtitle ? ` – ${book.subtitle}` : ''} | ${authorName}`,
        description: s.metaDescription || clip(book.description || book.subtitle, 160),
        keywords: s.keywords,
        image: img,
        type: 'book',
        noindex: s.noindex,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Book',
          name: book.title,
          alternativeHeadline: book.subtitle || undefined,
          description: clip(book.description || book.subtitle, 300),
          image: img || undefined,
          inLanguage: book.language,
          isbn: book.isbn || undefined,
          author: { '@type': 'Person', name: authorName },
          url: base.url,
          offers: { '@type': 'Offer', url: book.amazonUrl, availability: 'https://schema.org/InStock' },
        },
      }),
    };
  }

  if (pathname.startsWith('/admin')) {
    return { status: 200, tags: headTags({ ...base, title: 'Admin', noindex: true }) };
  }
  return { status: 404, tags: headTags({ ...base, title: `Page not found | ${settings.siteName}`, noindex: true }) };
}

let cachedHtml = null;
function template() {
  const file = path.join(config.clientDist, 'index.html');
  if (!fs.existsSync(file)) return null;
  if (!cachedHtml || process.env.NODE_ENV !== 'production') cachedHtml = fs.readFileSync(file, 'utf8');
  return cachedHtml;
}

async function renderPage(req, res, next) {
  try {
    const html = template();
    if (!html) return res.status(503).send('Client not built yet. Run: npm run build');
    const meta = await metaFor(req.path.replace(/\/+$/, '') || '/');
    if (meta.redirect) return res.redirect(301, meta.redirect);
    const { status, tags } = meta;
    res.status(status).type('html').send(html.replace('<!--SEO_HEAD-->', tags));
  } catch (e) {
    next(e);
  }
}

async function sitemap(_req, res, next) {
  try {
    const books = await Book.find({ published: true, 'seo.noindex': { $ne: true } }).select('slug updatedAt').lean();
    const urls = [
      { loc: `${config.siteUrl}/` },
      { loc: `${config.siteUrl}/about` },
      ...books.map((b) => ({ loc: `${config.siteUrl}/books/${encodeURIComponent(b.slug)}`, lastmod: b.updatedAt.toISOString().slice(0, 10) })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
      .join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  } catch (e) {
    next(e);
  }
}

async function robots(_req, res, next) {
  try {
    const s = await getSettings();
    res
      .type('text/plain')
      .send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n${s.robotsExtra ? `${s.robotsExtra}\n` : ''}\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
  } catch (e) {
    next(e);
  }
}

module.exports = { renderPage, sitemap, robots };
