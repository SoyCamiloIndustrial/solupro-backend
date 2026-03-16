/**
 * fix-db.js — Script de migración segura para SoluPro v7.11
 *
 * Uso:
 *   node fix-db.js
 *
 * Requiere la variable de entorno DATABASE_URL (igual que el servidor).
 * Usa ADD COLUMN IF NOT EXISTS para que sea seguro correrlo múltiples veces
 * sin riesgo de borrar datos existentes.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔌 Conectado a la base de datos. Iniciando migración...\n');

    await client.query('BEGIN');

    // ── TABLA: users ──────────────────────────────────────────────────────
    // FIX #3a: Asegura que password_hash exista
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_hash TEXT;
    `);
    console.log('✅ users.password_hash — OK');

    // ── TABLA: transactions ───────────────────────────────────────────────
    // FIX #3b: Asegura que reference, status y amount existan
    await client.query(`
      ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS reference  TEXT,
        ADD COLUMN IF NOT EXISTS status     TEXT,
        ADD COLUMN IF NOT EXISTS amount     BIGINT;
    `);
    console.log('✅ transactions.reference / status / amount — OK');

    // ── TABLA: lessons ────────────────────────────────────────────────────
    // Garantiza que las columnas usadas en el endpoint de curriculum existan.
    // course_id, bunny_video_id y order_num deben estar presentes.
    await client.query(`
      ALTER TABLE lessons
        ADD COLUMN IF NOT EXISTS course_id      INTEGER,
        ADD COLUMN IF NOT EXISTS bunny_video_id TEXT,
        ADD COLUMN IF NOT EXISTS order_num      INTEGER;
    `);
    console.log('✅ lessons.course_id / bunny_video_id / order_num — OK');

    // ── ÍNDICE OPCIONAL: mejora el rendimiento del filtro por course_id ───
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons (course_id);
    `);
    console.log('✅ Índice idx_lessons_course_id — OK');

    await client.query('COMMIT');

    console.log('\n🎉 Migración completada sin errores. Cero datos borrados.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error durante la migración. Se hizo ROLLBACK completo.');
    console.error('   Detalle:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();