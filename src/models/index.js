const mongoose = require('mongoose');
const { Schema } = mongoose;

const seo = {
  metaTitle: { type: String, default: '', trim: true, maxlength: 120 },
  metaDescription: { type: String, default: '', trim: true, maxlength: 320 },
  keywords: { type: String, default: '', trim: true, maxlength: 400 },
  ogImage: { type: String, default: '', trim: true },
  noindex: { type: Boolean, default: false },
};

const bookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subtitle: { type: String, default: '', trim: true, maxlength: 400 },
    slug: { type: String, required: true, unique: true, index: true },
    language: { type: String, default: 'en', trim: true, lowercase: true }, // en, ta, ...
    description: { type: String, default: '', maxlength: 8000 },
    cover: { type: String, default: '' }, // /uploads/xyz.jpg
    amazonUrl: { type: String, required: true, trim: true },
    isbn: { type: String, default: '', trim: true },
    order: { type: Number, default: 0, index: true },
    published: { type: Boolean, default: true },
    clicks: { type: Number, default: 0 }, // taps on Buy on Amazon
    oldSlugs: { type: [String], default: [], index: true }, // old web addresses redirect to the new one
    seo,
  },
  { timestamps: true }
);

const authorSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true },
    name: { type: String, default: '' },
    coAuthors: { type: String, default: '' },
    tagline: { type: String, default: '' },
    photo: { type: String, default: '' },
    bio: { type: String, default: '' }, // plain text, blank line = new paragraph
    qualifications: { type: [String], default: [] },
    highlights: { type: [{ label: String, value: String }], default: [] },
    email: { type: String, default: '' },
    socials: {
      website: { type: String, default: '' },
      amazon: { type: String, default: '' },
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      youtube: { type: String, default: '' },
      twitter: { type: String, default: '' },
      linkedin: { type: String, default: '' },
    },
    seo,
  },
  { timestamps: true }
);

const settingsSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true },
    siteName: { type: String, default: 'Books by the Author' },
    homeHeading: { type: String, default: 'Better thinking, brighter living.' },
    homeSubheading: { type: String, default: 'Tap a cover to read more and buy it on Amazon.' },
    footerText: { type: String, default: '' },
    authorAmazonUrl: { type: String, default: '' },
    defaultOgImage: { type: String, default: '' },
    twitterHandle: { type: String, default: '' },
    googleVerification: { type: String, default: '' },
    bingVerification: { type: String, default: '' },
    gaId: { type: String, default: '' }, // G-XXXXXXX
    robotsExtra: { type: String, default: '' },
    homeSeo: seo,
  },
  { timestamps: true }
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

const contactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = {
  Contact: mongoose.model('Contact', contactSchema),
  Book: mongoose.model('Book', bookSchema),
  Author: mongoose.model('Author', authorSchema),
  Settings: mongoose.model('Settings', settingsSchema),
  User: mongoose.model('User', userSchema),
};
