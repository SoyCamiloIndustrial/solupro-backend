require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Ejecutando migracion v8.0...');
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lesson_progress (
        id           SERIAL PRIMARY KEY,
        email        TEXT        NOT NULL,
        lesson_id    INTEGER     NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (email, lesson_id)
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_progress_email ON lesson_progress (email)');
    await client.query('COMMIT');
    console.log('✅ Migracion v8.0 completada.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error migracion:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
migrate();
