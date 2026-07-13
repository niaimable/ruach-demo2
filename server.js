// Local development server
require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const { init } = require('./db');
const api = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(express.json());
app.use('/api', api);

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    else if (filePath.endsWith('.css') || filePath.endsWith('.js')) res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

app.get('/app/admin*', (req, res) => res.sendFile(path.join(__dirname, 'public/app/admin/index.html')));
app.get('/app*', (req, res) => res.sendFile(path.join(__dirname, 'public/app/index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

init().then(() => {
  app.listen(PORT, () => {
    console.log(`
  ===========================================
  🌿 Ruach Practice App running locally
  📍 http://localhost:${PORT}
  🔒 Admin: /app/admin
  👤 Client: /app
  ===========================================`);
  });
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });
