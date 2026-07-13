const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

const db = createClient({
  url:       process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

async function run(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return { lastID: Number(result.lastInsertRowid ?? 0), changes: result.rowsAffected };
}

async function get(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows[0] ?? null;
}

async function all(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows;
}

async function init() {
  // Create tables one by one (Turso supports executeMultiple but safer to do individually)
  const tables = [
    `CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      date_of_birth TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      preferred_language TEXT DEFAULT 'English',
      how_heard TEXT,
      intake_completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      slot_duration_mins INTEGER DEFAULT 50,
      is_active INTEGER DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      session_type TEXT DEFAULT 'Individual therapy',
      notes_for_client TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS session_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER,
      client_id INTEGER NOT NULL,
      note_date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS intake_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER UNIQUE NOT NULL,
      reason_for_seeking TEXT,
      previous_therapy TEXT,
      current_medications TEXT,
      mental_health_history TEXT,
      goals TEXT,
      anything_else TEXT,
      submitted_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_type TEXT NOT NULL,
      from_id INTEGER NOT NULL,
      to_type TEXT NOT NULL,
      to_id INTEGER,
      client_id INTEGER NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      sent_at TEXT DEFAULT (datetime('now'))
    )`
  ];

  for (const sql of tables) {
    await db.execute(sql);
  }

  // Seed admin if not exists
  const admin = await get(`SELECT id FROM admin WHERE id = 1`);
  if (!admin) {
    const hash = await bcrypt.hash('Ruach2024!', 10);
    await run(
      `INSERT INTO admin (id, email, password_hash, name) VALUES (1, 'melissa@ruachpsychotherapy.com', ?, 'Melissa')`,
      [hash]
    );
    console.log('✅ Admin seeded');
  }

  // Seed availability Mon-Fri if empty
  const avail = await get(`SELECT id FROM availability LIMIT 1`);
  if (!avail) {
    for (const d of [1, 2, 3, 4, 5]) {
      await run(
        `INSERT INTO availability (day_of_week, start_time, end_time, slot_duration_mins) VALUES (?, '09:00', '17:00', 50)`,
        [d]
      );
    }
    console.log('✅ Availability seeded (Mon-Fri 9am-5pm)');
  }
}

module.exports = { db, run, get, all, init };
