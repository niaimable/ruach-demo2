const express = require('express');
const { init } = require('./db');
const apiRoutes = require('./api');

const app = express();
app.use(express.json());

// Initialize DB once on cold start
const dbReady = init().catch(err => {
  console.error('DB init failed:', err.message);
});

// Wait for DB before handling requests
app.use(async (req, res, next) => {
  await dbReady;
  next();
});

app.use('/api', apiRoutes);

// Export for Vercel
module.exports = app;