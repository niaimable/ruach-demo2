const express = require('express');
const path = require('path');
const compression = require('compression');
const { init } = require('./db');
const api = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(express.json());

// API routes
app.use('/api', api);

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html', 'htm'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    else if (filePath.endsWith('.css') || filePath.endsWith('.js')) res.setHeader('Cache-Control', 'public, max-age=31536000');
    else if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/)) res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

app.use((req, res, next) => {
  if (req.path.endsWith('.html')) return res.redirect(301, req.path.slice(0, -5));
  if (req.path !== '/' && req.path.endsWith('/')) return res.redirect(301, req.path.slice(0, -1));
  next();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

init().then(() => {
  app.listen(PORT, () => {
    console.log(`
  ===========================================
  🌿 Ruach Practice App is running!
  📍 http://localhost:${PORT}
  🔒 Admin: /app/admin
  👤 Client: /app
  ===========================================`);
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});