require('dotenv').config();
const { createClient } = require('@libsql/client');

const db = createClient({
  url:       process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

async function test() {
  console.log('Testing connection...');
  try {
    const r = await db.execute({ sql: 'SELECT 1', args: [] });
    console.log('OK Basic query works');
  } catch(e) {
    console.log('FAIL Basic query:', e.message);
    return;
  }
  try {
    await db.execute({ sql: 'CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY)', args: [] });
    console.log('OK CREATE TABLE works');
    await db.execute({ sql: 'DROP TABLE IF EXISTS test_table', args: [] });
  } catch(e) {
    console.log('FAIL CREATE TABLE:', e.message);
    return;
  }
  try {
    await db.execute({ sql: "CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))", args: [] });
    console.log('OK Admin table with DEFAULT works');
  } catch(e) {
    console.log('FAIL Admin table:', e.message);
  }
  process.exit(0);
}
test().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
