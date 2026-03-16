require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function repair() {
  try {
    console.log("🛠️ Iniciando inyección de columnas faltantes...");

    // 1. Agregar columnas a 'lessons' (Soluciona las 0 lecciones)
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS order_num INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS bunny_video_id TEXT;`);

    // 2. Agregar columnas a 'users' y 'transactions'
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
    await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;`);

    // 3. Vincular los videos al curso de Excel (ID 2)
    console.log("📥 Sembrando lecciones para el curso ID 2...");
    await pool.query(`DELETE FROM lessons WHERE course_id IS NULL OR course_id = 2;`);
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Bienvenido al Beef de Excel', '687b1c31-6453-4375-8e66-a2a828319397', 1),
      (2, 'Configuración Pro del entorno', '687b1c31-6453-4375-8e66-a2a828319397', 2),
      (2, 'Tu primera tabla dinámica', '687b1c31-6453-4375-8e66-a2a828319397', 3)
    `);

    console.log("✅ ¡Cirugía exitosa! Columnas y videos listos.");
  } catch (err) {
    console.error("❌ Error en la reparación:", err.message);
  } finally {
    await pool.end();
  }
}
repair();