const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    `);
    console.log("✅ Columna password_hash agregada");

    const result = await client.query('SELECT id, email, password_hash FROM users LIMIT 5');
    console.log("📋 Usuarios actuales:");
    console.table(result.rows);
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fix();