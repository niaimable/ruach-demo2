const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { run, get, all } = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ruach-secret-key-change-in-production';

// ─── Auth middleware ───────────────────────────────────────────────────────────

function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function authClient(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'client') return res.status(403).json({ error: 'Forbidden' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function authAny(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Admin auth ────────────────────────────────────────────────────────────────

router.post('/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await get(`SELECT * FROM admin WHERE email = ?`, [email]);
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin.id, role: 'admin', name: admin.name }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, name: admin.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Client auth ───────────────────────────────────────────────────────────────

router.post('/auth/client/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, date_of_birth, preferred_language, how_heard } = req.body;
    if (!email || !password || !first_name || !last_name) return res.status(400).json({ error: 'Required fields missing' });
    const existing = await get(`SELECT id FROM clients WHERE email = ?`, [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      `INSERT INTO clients (email, password_hash, first_name, last_name, phone, date_of_birth, preferred_language, how_heard) VALUES (?,?,?,?,?,?,?,?)`,
      [email, hash, first_name, last_name, phone ?? null, date_of_birth ?? null, preferred_language || 'English', how_heard ?? null]
    );
    const token = jwt.sign({ id: result.lastID, role: 'client', name: first_name }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, name: first_name, id: result.lastID });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/auth/client/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const client = await get(`SELECT * FROM clients WHERE email = ?`, [email]);
    if (!client) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, client.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: client.id, role: 'client', name: client.first_name }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, name: client.first_name, id: client.id, intake_completed: client.intake_completed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Clients (admin) ───────────────────────────────────────────────────────────

router.get('/admin/clients', authAdmin, async (req, res) => {
  try {
    const clients = await all(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM appointments a WHERE a.client_id = c.id AND a.status = 'confirmed') as session_count,
        (SELECT COUNT(*) FROM messages m WHERE m.client_id = c.id AND m.is_read = 0 AND m.from_type = 'client') as unread_msgs,
        (SELECT date FROM appointments a WHERE a.client_id = c.id AND a.date >= date('now') AND a.status = 'confirmed' ORDER BY a.date, a.start_time LIMIT 1) as next_session
      FROM clients c ORDER BY c.created_at DESC
    `);
    res.json(clients);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin/clients/:id', authAdmin, async (req, res) => {
  try {
    const client = await get(`SELECT * FROM clients WHERE id = ?`, [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Not found' });
    const appointments = await all(`SELECT * FROM appointments WHERE client_id = ? ORDER BY date DESC, start_time DESC`, [req.params.id]);
    const intake = await get(`SELECT * FROM intake_forms WHERE client_id = ?`, [req.params.id]);
    res.json({ client, appointments, intake });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Availability (admin) ──────────────────────────────────────────────────────

router.get('/admin/availability', authAdmin, async (req, res) => {
  try {
    const slots = await all(`SELECT * FROM availability ORDER BY day_of_week, start_time`);
    res.json(slots);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/availability', authAdmin, async (req, res) => {
  try {
    const { day_of_week, start_time, end_time, slot_duration_mins } = req.body;
    const result = await run(
      `INSERT INTO availability (day_of_week, start_time, end_time, slot_duration_mins) VALUES (?,?,?,?)`,
      [day_of_week, start_time, end_time, slot_duration_mins || 50]
    );
    res.json({ id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/admin/availability/:id', authAdmin, async (req, res) => {
  try {
    const { start_time, end_time, slot_duration_mins, is_active } = req.body;
    await run(`UPDATE availability SET start_time=?, end_time=?, slot_duration_mins=?, is_active=? WHERE id=?`,
      [start_time ?? null, end_time ?? null, slot_duration_mins ?? 50, is_active ?? 1, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/admin/availability/:id', authAdmin, async (req, res) => {
  try {
    await run(`DELETE FROM availability WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Appointments (admin) ──────────────────────────────────────────────────────

router.get('/admin/appointments', authAdmin, async (req, res) => {
  try {
    const { from, to, status } = req.query;
    let sql = `SELECT a.*, c.first_name, c.last_name, c.email, c.phone FROM appointments a LEFT JOIN clients c ON c.id = a.client_id WHERE 1=1`;
    const params = [];
    if (from) { sql += ` AND a.date >= ?`; params.push(from); }
    if (to) { sql += ` AND a.date <= ?`; params.push(to); }
    if (status) { sql += ` AND a.status = ?`; params.push(status); }
    sql += ` ORDER BY a.date ASC, a.start_time ASC`;
    const rows = await all(sql, params);
    // Guard against missing client data so the UI never silently drops a row
    const safe = rows.map(r => ({
      ...r,
      first_name: r.first_name || 'Unknown',
      last_name: r.last_name || 'client',
      email: r.email || '—',
      phone: r.phone || null
    }));
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/admin/appointments/:id', authAdmin, async (req, res) => {
  try {
    const { status, notes_for_client } = req.body;
    await run(`UPDATE appointments SET status=?, notes_for_client=? WHERE id=?`,
      [status ?? null, notes_for_client ?? null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Session notes (admin only) ───────────────────────────────────────────────

router.get('/admin/notes/:clientId', authAdmin, async (req, res) => {
  try {
    const notes = await all(`SELECT * FROM session_notes WHERE client_id = ? ORDER BY note_date DESC, created_at DESC`, [req.params.clientId]);
    res.json(notes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/notes', authAdmin, async (req, res) => {
  try {
    const { client_id, appointment_id, note_date, content } = req.body;
    const result = await run(
      `INSERT INTO session_notes (client_id, appointment_id, note_date, content) VALUES (?,?,?,?)`,
      [client_id, appointment_id || null, note_date, content]
    );
    res.json({ id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/admin/notes/:id', authAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    await run(`UPDATE session_notes SET content=?, updated_at=datetime('now') WHERE id=?`, [content, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/admin/notes/:id', authAdmin, async (req, res) => {
  try {
    await run(`DELETE FROM session_notes WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Intake forms ──────────────────────────────────────────────────────────────

router.post('/intake', authClient, async (req, res) => {
  try {
    const { reason_for_seeking, previous_therapy, current_medications, mental_health_history, goals, anything_else, emergency_contact_name, emergency_contact_phone } = req.body;
    await run(`INSERT OR REPLACE INTO intake_forms (client_id, reason_for_seeking, previous_therapy, current_medications, mental_health_history, goals, anything_else) VALUES (?,?,?,?,?,?,?)`,
      [req.user.id, reason_for_seeking ?? null, previous_therapy ?? null, current_medications ?? null, mental_health_history ?? null, goals ?? null, anything_else ?? null]);
    await run(`UPDATE clients SET intake_completed=1, emergency_contact_name=?, emergency_contact_phone=? WHERE id=?`,
      [emergency_contact_name ?? null, emergency_contact_phone ?? null, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Booking (client) ──────────────────────────────────────────────────────────

router.get('/booking/slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const d = new Date(date + 'T12:00:00Z');
    const dow = d.getUTCDay(); // 0=Sun
    const avail = await all(`SELECT * FROM availability WHERE day_of_week=? AND is_active=1`, [dow]);
    if (!avail.length) return res.json([]);

    // Get already booked slots
    const booked = await all(`SELECT start_time FROM appointments WHERE date=? AND status != 'cancelled'`, [date]);
    const bookedTimes = new Set(booked.map(b => b.start_time));

    const slots = [];
    for (const block of avail) {
      let [sh, sm] = block.start_time.split(':').map(Number);
      const [eh, em] = block.end_time.split(':').map(Number);
      const endMins = eh * 60 + em;
      while (sh * 60 + sm + block.slot_duration_mins <= endMins) {
        const timeStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
        if (!bookedTimes.has(timeStr)) slots.push(timeStr);
        sm += block.slot_duration_mins;
        sh += Math.floor(sm / 60);
        sm = sm % 60;
      }
    }
    res.json(slots);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/booking/request', authClient, async (req, res) => {
  try {
    const { date, start_time, session_type } = req.body;
    const avail = await get(`SELECT * FROM availability WHERE day_of_week=? AND is_active=1 LIMIT 1`,
      [new Date(date + 'T12:00:00Z').getUTCDay()]);
    if (!avail) return res.status(400).json({ error: 'No availability on that day' });

    const conflict = await get(`SELECT id FROM appointments WHERE date=? AND start_time=? AND status != 'cancelled'`, [date, start_time]);
    if (conflict) return res.status(409).json({ error: 'Slot already taken' });

    const [sh, sm] = start_time.split(':').map(Number);
    const endMins = sh * 60 + sm + avail.slot_duration_mins;
    const end_time = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;

    const result = await run(
      `INSERT INTO appointments (client_id, date, start_time, end_time, status, session_type) VALUES (?,?,?,?,'pending',?)`,
      [req.user.id, date, start_time, end_time, session_type || 'Individual therapy']
    );
    res.json({ id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/client/appointments', authClient, async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM appointments WHERE client_id=? ORDER BY date DESC, start_time DESC`, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/client/appointments/:id/cancel', authClient, async (req, res) => {
  try {
    const apt = await get(`SELECT * FROM appointments WHERE id=? AND client_id=?`, [req.params.id, req.user.id]);
    if (!apt) return res.status(404).json({ error: 'Not found' });
    await run(`UPDATE appointments SET status='cancelled' WHERE id=?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Messages ─────────────────────────────────────────────────────────────────

router.get('/messages/:clientId', authAny, async (req, res) => {
  try {
    const clientId = req.params.clientId;
    if (req.user.role === 'client' && req.user.id != clientId) return res.status(403).json({ error: 'Forbidden' });
    const msgs = await all(`SELECT * FROM messages WHERE client_id=? ORDER BY sent_at ASC`, [clientId]);
    // Mark unread as read
    if (req.user.role === 'admin') {
      await run(`UPDATE messages SET is_read=1 WHERE client_id=? AND from_type='client'`, [clientId]);
    } else {
      await run(`UPDATE messages SET is_read=1 WHERE client_id=? AND from_type='admin'`, [clientId]);
    }
    res.json(msgs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/messages', authAny, async (req, res) => {
  try {
    const { client_id, body, subject } = req.body;
    if (req.user.role === 'client' && req.user.id != client_id) return res.status(403).json({ error: 'Forbidden' });
    await run(`INSERT INTO messages (from_type, from_id, to_type, to_id, client_id, subject, body) VALUES (?,?,?,?,?,?,?)`,
      [req.user.role, req.user.id, req.user.role === 'admin' ? 'client' : 'admin', null, client_id, subject || null, body]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin/messages/unread', authAdmin, async (req, res) => {
  try {
    const rows = await all(`
      SELECT m.client_id, COUNT(*) as count, c.first_name, c.last_name
      FROM messages m JOIN clients c ON c.id = m.client_id
      WHERE m.is_read=0 AND m.from_type='client'
      GROUP BY m.client_id
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/admin/clients/:id/personal', authAdmin, async (req, res) => {
  try {
    const { date_of_birth, phone, emergency_contact_name, emergency_contact_phone, how_heard } = req.body;
    await run(
      `UPDATE clients SET date_of_birth=?, phone=?, emergency_contact_name=?, emergency_contact_phone=?, how_heard=? WHERE id=?`,
      [date_of_birth ?? null, phone ?? null, emergency_contact_name ?? null, emergency_contact_phone ?? null, how_heard ?? null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Clinical notes (admin only — not visible to client) ───────────────────

router.put('/admin/clinical/:clientId', authAdmin, async (req, res) => {
  try {
    const { current_medications, mental_health_history } = req.body;
    const clientId = req.params.clientId;
    // Upsert into intake_forms — create row if none exists yet
    const existing = await get(`SELECT id FROM intake_forms WHERE client_id = ?`, [clientId]);
    if (existing) {
      await run(
        `UPDATE intake_forms SET current_medications=?, mental_health_history=? WHERE client_id=?`,
        [current_medications ?? null, mental_health_history ?? null, clientId]
      );
    } else {
      await run(
        `INSERT INTO intake_forms (client_id, current_medications, mental_health_history) VALUES (?,?,?)`,
        [clientId, current_medications ?? null, mental_health_history ?? null]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Admin dashboard stats ─────────────────────────────────────────────────────

router.get('/admin/stats', authAdmin, async (req, res) => {
  try {
    const totalClients = await get(`SELECT COUNT(*) as n FROM clients`);
    const pendingApts = await get(`SELECT COUNT(*) as n FROM appointments WHERE status='pending'`);
    const todayApts = await get(`SELECT COUNT(*) as n FROM appointments WHERE date=date('now') AND status='confirmed'`);
    const weekApts = await get(`SELECT COUNT(*) as n FROM appointments WHERE date BETWEEN date('now') AND date('now','+7 days') AND status='confirmed'`);
    const unreadMsgs = await get(`SELECT COUNT(*) as n FROM messages WHERE is_read=0 AND from_type='client'`);
    const newIntakes = await get(`SELECT COUNT(*) as n FROM intake_forms WHERE submitted_at >= datetime('now', '-7 days')`);
    res.json({
      totalClients: totalClients.n,
      pendingAppointments: pendingApts.n,
      todaySessions: todayApts.n,
      weekSessions: weekApts.n,
      unreadMessages: unreadMsgs.n,
      newIntakes: newIntakes.n
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;