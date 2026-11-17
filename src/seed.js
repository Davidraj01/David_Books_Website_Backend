// npm run seed  -> creates the admin user (if none), default settings, About page and the 26 books
// Safe to run again: it never duplicates books and never overwrites existing data.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const config = require('./config');
const { Book, Author, Settings, User } = require('./models');
const { uniqueSlug } = require('./util');

(async () => {
  await mongoose.connect(config.mongoUri);

  if (!(await User.countDocuments())) {
    const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
    const pw = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    await User.create({ email, passwordHash: await bcrypt.hash(pw, 12) });
    console.log(`Admin created: ${email}  (change the password after first login)`);
  }

  if (!(await Settings.findOne({ key: 'main' }))) {
    await Settings.create({
      key: 'main',
      siteName: 'Dr. S. Davidraj – Books',
      homeHeading: 'Better thinking, brighter living.',
      homeSubheading: 'Books by Dr. S. Davidraj and Bright Livingstone Davidraj. Tap a cover to read more and buy it on Amazon.',
      authorAmazonUrl: 'https://www.amazon.com/author/dr.s.davidrajbooks',
      footerText: 'Dr. S. Davidraj & Bright Livingstone Davidraj',
    });
  }
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const existingAuthor = await Author.findOne({ key: 'main' });
  if (!existingAuthor) {
    fs.copyFileSync(path.join(__dirname, '..', 'seed', 'author.jpg'), path.join(config.uploadDir, 'seed-author.jpg'));
    await Author.create({
      key: 'main',
      name: 'Dr. S. Davidraj',
      coAuthors: 'Writer · Environmental Conservationist · Trainer',
      tagline: 'Entrepreneur & Environmentalist',
      photo: '/uploads/seed-author.jpg',
      bio: [
        'Dr. S. Davidraj is a writer, environmental conservationist, entrepreneur and trainer. Born in the village of Mettur in Tenkasi district, Tamil Nadu, he has spent his working life between two very different worlds: the forest and the boardroom.',
        'He served as an Assistant Conservator of Forests, and he is the Founder and Chairman of the Marine Biodiversity Conservation Trust (MBCT). Alongside this work he has run a software and technology company for more than 14 years.',
        'His books speak to young people, families and people of faith. In English he writes about the way we think, the habits we build, the careers of the future and life in the age of artificial intelligence, in titles such as The Mind That Builds Your Future, The Next Human and The Job You Don’t Know Exists. In Tamil he writes about relationships, character and the Bible, and about forests and nature, from Andaman and the Jarawa people to the truths humans forget about the natural world.',
        'His books are published under DAVIDRAJ INTERNATIONAL PUBLICATIONS. Two of them, The Mind That Builds Your Future and The Price of Always Being Right, are co-authored with his son Bright Livingstone Davidraj, CEO and Founder of Webnexs.',
      ].join('\n\n'),
      qualifications: ['MBA', 'Ph.D', 'BL'],
      highlights: [
        { value: '14+', label: 'Years running a technology company' },
        { value: '2', label: 'Languages: English and Tamil' },
        { value: 'MBCT', label: 'Founder and Chairman, Marine Biodiversity Conservation Trust' },
      ],
      socials: { amazon: 'https://www.amazon.com/author/dr.s.davidrajbooks' },
      seo: {
        metaTitle: 'About Dr. S. Davidraj – Author, Entrepreneur and Environmentalist',
        metaDescription: 'Dr. S. Davidraj is a writer, environmental conservationist, entrepreneur and trainer, and a former Assistant Conservator of Forests. Meet the author behind the books.',
      },
    });
  }

  const books = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'books.json'), 'utf8'));
  let added = 0;
  for (const b of books) {
    if (await Book.exists({ amazonUrl: b.amazonUrl, title: b.title })) continue;
    const dest = `seed-${b.cover}`;
    fs.copyFileSync(path.join(__dirname, '..', 'seed', 'covers', b.cover), path.join(config.uploadDir, dest));
    await Book.create({
      title: b.title,
      subtitle: b.subtitle,
      description: b.description || '',
      language: b.language,
      amazonUrl: b.amazonUrl,
      cover: `/uploads/${dest}`,
      order: b.order,
      slug: await uniqueSlug(b.title),
    });
    added += 1;
  }
  console.log(`Books added: ${added}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
