require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  try {
    console.log("⏳ Reparando estructura y cargando videos...");

    // 1. Forzamos las columnas que los logs dicen que faltan
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS order_num INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS bunny_video_id TEXT;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
    await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;`);

    // 2. Metemos los videos para el curso de Excel (ID 2)
    await pool.query(`DELETE FROM lessons WHERE course_id = 2;`); // Limpiamos primero
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Bienvenido al Beef de Excel', '687b1c31-6453-4375-8e66-a2a828319397', 1),
      (2, 'Configuración del Entorno', '687b1c31-6453-4375-8e66-a2a828319397', 2),
      (2, 'Tu primera Tabla Dinámica', '687b1c31-6453-4375-8e66-a2a828319397', 3)
    `);

    console.log("✅ ¡Cirugía exitosa! Refresca el panel en la web.");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await pool.end();
  }
}
fix();