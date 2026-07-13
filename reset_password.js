const bcrypt = require('bcryptjs');
const { init, get, run } = require('./db');

const [,, role, email, newPassword] = process.argv;

if (!role || !email || !newPassword) {
  console.log('\nUsage:');
  console.log('  node reset_password.js client <email> <new-password>');
  console.log('  node reset_password.js admin  <email> <new-password>\n');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

init().then(async () => {
  const table = role === 'admin' ? 'admin' : 'clients';
  const user = await get(`SELECT id, email FROM ${table} WHERE email = ?`, [email]);
  if (!user) {
    console.error(`❌ No ${role} account found with email: ${email}`);
    process.exit(1);
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await run(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [hash, user.id]);
  console.log(`\n✅ Password reset successfully!`);
  console.log(`   Account : ${email}`);
  console.log(`   New pass: ${newPassword}\n`);
  process.exit(0);
}).catch(e => { console.error('Error:', e.message); process.exit(1); });