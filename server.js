const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression()); // Gzip compression
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html', 'htm'], // Serve .html files without extension
  setHeaders: (res, filePath) => {
    // Set cache headers for better performance
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// Redirect .html and trailing slashes
app.use((req, res, next) => {
  // Remove .html extension
  if (req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5);
    return res.redirect(301, cleanPath);
  }

  // Remove trailing slash
  if (req.path !== '/' && req.path.endsWith('/')) {
    const cleanPath = req.path.slice(0, -1);
    return res.redirect(301, cleanPath);
  }

  next();
});

// Serve index.html for all routes (SPA style) - SIMPLIFIED VERSION
// This is the key fix: either add 'next' parameter OR remove the next() call
app.get('*', (req, res) => {
  // Serve index.html for all routes
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handling - serve index.html for SPA routing
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ===========================================
  🚀 Ruach Counselling Website is running!
  📍 Local: http://localhost:${PORT}
  📍 Network: http://YOUR_IP:${PORT}
  ===========================================
  
  Clean URLs enabled:
  • http://localhost:${PORT}/about (instead of /about.html)
  • http://localhost:${PORT}/services
  • http://localhost:${PORT}/contact
  
  All requests will serve your beautiful single-page app!
  `);
});