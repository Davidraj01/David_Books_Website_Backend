require('dotenv').config();
const path = require('path');

const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/author-site',
  jwtSecret: process.env.JWT_SECRET,
  siteUrl: (process.env.SITE_URL || (process.env.RENDER ? 'https://david-books-website-frontend.vercel.app' : `http://localhost:${process.env.PORT || 5000}`)).replace(/\/+$/, ''),
  uploadDir: path.join(__dirname, '..', 'uploads'),
  clientDist: path.join(__dirname, '..', '..', 'client', 'dist'),
};

if (!config.jwtSecret || config.jwtSecret.length < 16) {
  console.error('JWT_SECRET is missing or too short. Set it in server/.env');
  process.exit(1);
}
module.exports = config;
