const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const seo = require('./seo');

const app = express();
app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false, // pages load Google Fonts and (optionally) Google Analytics
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// async route errors -> express error handler (express 4 does not do this itself)
const wrap = (router) => {
  ['get', 'post', 'put', 'patch', 'delete'].forEach((m) => {
    const orig = router[m].bind(router);
    router[m] = (p, ...handlers) =>
      orig(
        p,
        ...handlers.map((h) =>
          typeof h === 'function' && h.length < 4
            ? (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
            : h
        )
      );
  });
  return router;
};

app.use('/api/auth', wrap(require('./routes/auth')));
app.use('/api/admin', wrap(require('./routes/admin')));
app.use('/api', wrap(require('./routes/public')));
app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));

app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d', immutable: true }));
app.get('/sitemap.xml', seo.sitemap);
app.get('/robots.txt', seo.robots);

// built React app (assets are fingerprinted, index.html is rendered with SEO tags)
app.use(express.static(config.clientDist, { index: false, maxAge: '30d' }));
app.get('*', seo.renderPage);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(', ') });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  res.status(500).json({ message: 'Something went wrong on the server' });
});

mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('MongoDB connected successfully');
    app.listen(config.port, () => console.log(`Server running on ${config.siteUrl} (port ${config.port})`));
  })
  .catch((e) => {
    console.error('Could not connect to MongoDB:', e.message);
    process.exit(1);
  });
