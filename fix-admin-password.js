require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixPassword() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, email, password, password_hash FROM users WHERE LOWER(email) = 'solupropro@gmail.com'"
    );
    if (result.rows.length === 0) {
      console.log('Usuario no encontrado.');
      process.exit(1);
    }
    const user = result.rows[0];
    if (!user.password || user.password.startsWith('$2b$')) {
      console.log('Ya hasheada o vacia. Nada que hacer.');
      process.exit(0);
    }
    console.log('Hasheando con salt_rounds=12...');
    const newHash = await bcrypt.hash(user.password, 12);
    await client.query('BEGIN');
    await client.query(
      "UPDATE users SET password_hash = $1, password = NULL WHERE LOWER(email) = 'solupropro@gmail.com'",
      [newHash]
    );
    await client.query('COMMIT');
    console.log('✅ password_hash actualizado. Campo password limpiado.');
    console.log('⚠️  Elimina fix-admin-password.js del repo.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
fixPassword();
