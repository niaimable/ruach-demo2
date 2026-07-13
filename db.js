const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'ruach.db.json');
let db;

// Persist db to disk as binary
function persist() {
  const data = db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buf);
}

// Auto-save every 10s
setInterval(persist, 10000);

function run(sql, params = []) {
  try {
    db.run(sql, params);
    // IMPORTANT: read last_insert_rowid() BEFORE persist(), because db.export()
    // (used inside persist) re-serializes the connection and resets it to 0.
    const lastID = db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] || 0;
    persist();
    return Promise.resolve({ lastID, changes: 1 });
  } catch(e) { return Promise.reject(e); }
}

function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return Promise.resolve(row);
    }
    stmt.free();
    return Promise.resolve(undefined);
  } catch(e) { return Promise.reject(e); }
}

function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return Promise.resolve(rows);
  } catch(e) { return Promise.reject(e); }
}

async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('  ✅ Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('  ✅ Created new database');
  }

  // Schema
  db.run(`CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS clients (
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    slot_duration_mins INTEGER DEFAULT 50,
    is_active INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    session_type TEXT DEFAULT 'Individual therapy',
    notes_for_client TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS session_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER,
    client_id INTEGER NOT NULL,
    note_date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS intake_forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER UNIQUE NOT NULL,
    reason_for_seeking TEXT,
    previous_therapy TEXT,
    current_medications TEXT,
    mental_health_history TEXT,
    goals TEXT,
    anything_else TEXT,
    submitted_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
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
  )`);

  // Seed admin
  const admin = await get(`SELECT id FROM admin WHERE id = 1`);
  if (!admin) {
    const hash = await bcrypt.hash('Ruach2024!', 10);
    db.run(`INSERT INTO admin (id, email, password_hash, name) VALUES (1, 'melissa@ruachpsychotherapy.com', ?, ?)`, [hash, 'Melissa']);
    console.log('  ✅ Admin created: melissa@ruachpsychotherapy.com / Ruach2024!');
  }

  // Seed availability
  const avail = await get(`SELECT id FROM availability LIMIT 1`);
  if (!avail) {
    for (const d of [1,2,3,4,5]) {
      db.run(`INSERT INTO availability (day_of_week, start_time, end_time) VALUES (?, '09:00', '17:00')`, [d]);
    }
    console.log('  ✅ Default availability seeded (Mon–Fri 9am–5pm)');
  }

  persist();
}

module.exports = { run, get, all, init };