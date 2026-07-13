// Vercel serverless entry point — wraps Express app
const express = require('express');
const { init } = require('./db');
const api = require('./api');

const app = express();
app.use(express.json());
app.use('/api', api);

// Init DB on cold start (Turso is remote so no file needed)
let initialized = false;
app.use(async (req, res, next) => {
  if (!initialized) {
    await init();
    initialized = true;
  }
  next();
});

module.exports = app;
