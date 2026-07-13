// Read-only inspection script. Run this against your LIVE server's ruach.db.json
// to see exactly what orphaned rows exist before deciding what to do with them.
const { init, all } = require('./db');

init().then(async () => {
  const orphans = await all(`
    SELECT a.id, a.client_id, a.date, a.start_time, a.end_time, a.status, a.session_type, a.created_at
    FROM appointments a
    LEFT JOIN clients c ON c.id = a.client_id
    WHERE c.id IS NULL
    ORDER BY a.date
  `);

  console.log(`Found ${orphans.length} orphaned appointment(s):\n`);
  orphans.forEach(o => {
    console.log(`  id=${o.id}  client_id=${o.client_id}  ${o.date} ${o.start_time}-${o.end_time}  status=${o.status}  type="${o.session_type}"  created=${o.created_at}`);
  });

  const realClients = await all(`SELECT id, first_name, last_name, email, created_at FROM clients ORDER BY created_at`);
  console.log(`\nReal clients on file (${realClients.length}):\n`);
  realClients.forEach(c => {
    console.log(`  id=${c.id}  ${c.first_name} ${c.last_name}  ${c.email}  registered=${c.created_at}`);
  });

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });