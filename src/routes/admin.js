const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const auth = require('../middleware/auth');
const sharp = require('sharp');
const { Book, Author, Settings, Contact } = require('../models');
const { uniqueSlug, slugify, isHttpUrl } = require('../util');
const { getSettings, getAuthor } = require('./public');

router.use(auth);

// ---------- uploads ----------
// Images are checked by decoding them (not by trusting the file name), resized to at most
// 1600px wide, auto-rotated, stripped of camera/location data and saved as WebP.
fs.mkdirSync(config.uploadDir, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => (/^image\/(jpeg|png|webp)$/.test(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG or WebP images are allowed'))),
});

router.post('/upload', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image is larger than 8 MB' : err.message });
    if (!req.file) return res.status(400).json({ message: 'No image received' });
    try {
      const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webp`;
      await sharp(req.file.buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 86 }).toFile(path.join(config.uploadDir, name));
      res.json({ url: `/uploads/${name}` });
    } catch {
      res.status(400).json({ message: 'That file is not a valid image' });
    }
  });
});

// ---------- helpers ----------
const plain = (x) => (x && typeof x.toObject === 'function' ? x.toObject() : { ...(x || {}) });
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
const SEO_KEYS = ['metaTitle', 'metaDescription', 'keywords', 'ogImage', 'noindex'];
const cleanSeo = (s = {}) => pick(s, SEO_KEYS);

// ---------- books ----------
router.get('/books', async (_req, res) => res.json(await Book.find().sort({ order: 1, createdAt: 1 }).lean()));

router.get('/books/:id', async (req, res) => {
  const b = await Book.findById(req.params.id).lean();
  if (!b) return res.status(404).json({ message: 'Book not found' });
  res.json(b);
});

router.post('/books', async (req, res) => {
  const b = req.body;
  if (!String(b.title || '').trim()) return res.status(400).json({ message: 'Title is required' });
  if (!isHttpUrl(b.amazonUrl)) return res.status(400).json({ message: 'Amazon link must start with https://' });
  const last = await Book.findOne().sort({ order: -1 }).lean();
  const book = await Book.create({
    ...pick(b, ['title', 'subtitle', 'language', 'description', 'cover', 'amazonUrl', 'isbn', 'published']),
    slug: await uniqueSlug(b.slug || b.title),
    order: (last?.order || 0) + 1,
    seo: cleanSeo(b.seo),
  });
  res.status(201).json(book);
});

router.put('/books/:id', async (req, res) => {
  const b = req.body;
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ message: 'Book not found' });
  if (b.title !== undefined && !String(b.title).trim()) return res.status(400).json({ message: 'Title is required' });
  if (b.amazonUrl !== undefined && !isHttpUrl(b.amazonUrl)) return res.status(400).json({ message: 'Amazon link must start with https://' });
  Object.assign(book, pick(b, ['title', 'subtitle', 'language', 'description', 'cover', 'amazonUrl', 'isbn', 'published']));
  if (b.slug !== undefined && b.slug !== '' && slugify(b.slug) !== book.slug) {
    const old = book.slug;
    book.slug = await uniqueSlug(b.slug, book._id);
    if (old !== book.slug) book.oldSlugs = [...new Set([...(book.oldSlugs || []), old])].filter((x) => x !== book.slug);
  }
  if (b.seo) book.seo = { ...plain(book.seo), ...cleanSeo(b.seo) };
  await book.save();
  res.json(book);
});

router.delete('/books/:id', async (req, res) => {
  await Book.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// body: { ids: [id1, id2, ...] } in the new display order
router.put('/books-order', async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  await Book.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { order: i + 1 } } })));
  res.json({ ok: true });
});

// ---------- messages from the contact form ----------
router.get('/messages', async (_req, res) => res.json(await Contact.find().sort({ createdAt: -1 }).limit(500).lean()));
router.put('/messages/:id', async (req, res) => res.json(await Contact.findByIdAndUpdate(req.params.id, { read: !!req.body.read }, { new: true })));
router.delete('/messages/:id', async (req, res) => { await Contact.findByIdAndDelete(req.params.id); res.json({ ok: true }); });

// ---------- backup (everything except images and the admin login) ----------
router.get('/export', async (_req, res) => {
  const [books, author, settings] = await Promise.all([Book.find().sort({ order: 1 }).lean(), getAuthor(), getSettings()]);
  res.setHeader('Content-Disposition', `attachment; filename="site-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ exportedAt: new Date().toISOString(), books, author, settings });
});

// ---------- author ----------
router.get('/author', async (_req, res) => res.json(await getAuthor()));
router.put('/author', async (req, res) => {
  const a = await getAuthor();
  const b = req.body;
  Object.assign(a, pick(b, ['name', 'coAuthors', 'tagline', 'photo', 'bio', 'email']));
  if (Array.isArray(b.qualifications)) a.qualifications = b.qualifications.map((x) => String(x).trim()).filter(Boolean);
  if (Array.isArray(b.highlights)) a.highlights = b.highlights.filter((h) => h && (h.label || h.value));
  if (b.socials) a.socials = { ...plain(a.socials), ...b.socials };
  if (b.seo) a.seo = { ...plain(a.seo), ...cleanSeo(b.seo) };
  await a.save();
  res.json(a);
});

// ---------- site settings / SEO ----------
router.get('/settings', async (_req, res) => res.json(await getSettings()));
router.put('/settings', async (req, res) => {
  const s = await getSettings();
  const b = req.body;
  Object.assign(
    s,
    pick(b, ['siteName', 'homeHeading', 'homeSubheading', 'footerText', 'authorAmazonUrl', 'defaultOgImage', 'twitterHandle', 'googleVerification', 'bingVerification', 'gaId', 'robotsExtra'])
  );
  if (b.homeSeo) s.homeSeo = { ...plain(s.homeSeo), ...cleanSeo(b.homeSeo) };
  await s.save();
  res.json(s);
});

module.exports = router;
