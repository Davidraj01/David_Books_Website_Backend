const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { Book, Author, Settings, Contact } = require('../models');

async function getSettings() {
  return (await Settings.findOne({ key: 'main' })) || (await Settings.create({ key: 'main' }));
}
async function getAuthor() {
  return (await Author.findOne({ key: 'main' })) || (await Author.create({ key: 'main' }));
}

router.get('/books', async (req, res) => {
  const q = { published: true };
  if (req.query.lang) q.language = String(req.query.lang).toLowerCase();
  res.json(await Book.find(q).sort({ order: 1, createdAt: 1 }).lean());
});

router.get('/books/:slug', async (req, res) => {
  const book = await Book.findOne({ slug: req.params.slug, published: true }).lean();
  if (book) return res.json(book);
  // the address was changed in the admin panel: tell the page where the book lives now
  const moved = await Book.findOne({ oldSlugs: req.params.slug, published: true }).select('slug').lean();
  if (moved) return res.json({ redirectTo: moved.slug });
  res.status(404).json({ message: 'Book not found' });
});

// counts taps on "Buy on Amazon" so the author can see which books people open
router.post('/books/:id/click', async (req, res) => {
  await Book.updateOne({ _id: req.params.id }, { $inc: { clicks: 1 } }).catch(() => {});
  res.status(204).end();
});

const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many messages, please try again later' } });
router.post('/contact', contactLimiter, async (req, res) => {
  if (req.body.website) return res.json({ ok: true }); // hidden field: bots fill it, people never see it
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const message = String(req.body.message || '').trim();
  if (!name || !message) return res.status(400).json({ message: 'Please enter your name and message' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Please enter a valid email address' });
  await Contact.create({ name, email, message });
  res.json({ ok: true });
});

router.get('/author', async (_req, res) => res.json(await getAuthor()));

router.get('/settings', async (_req, res) => {
  const s = (await getSettings()).toObject();
  // verification codes and robots text stay server-side only
  delete s.robotsExtra;
  res.json(s);
});

module.exports = router;
module.exports.getSettings = getSettings;
module.exports.getAuthor = getAuthor;
