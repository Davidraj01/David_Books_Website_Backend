const { Book } = require('./models');

// Tamil (and any non-latin) titles produce an empty ascii slug, so fall back to "book".
function slugify(text) {
  const s = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || 'book';
}

async function uniqueSlug(base, ignoreId) {
  let slug = slugify(base);
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Book.exists({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) })) {
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
  return slug;
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'http:' || x.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = { slugify, uniqueSlug, esc, isHttpUrl };
