require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixAll() {
  try {
    console.log("⏳ Inyectando columnas faltantes en SoluPro...");

    // 1. Reparar tabla 'users' (Asegurar password_hash)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);

    // 2. Reparar tabla 'lessons' (Asegurar course_id y order_num)
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS order_num INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS bunny_video_id TEXT;`);

    // 3. Reparar tabla 'transactions' (Asegurar reference)
    await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;`);

    // 4. Inyectar lecciones reales para el curso ID 2 (Excel)
    // Esto es lo que hará que dejen de salir "0 LECCIONES"
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Bienvenidos al Beef: Introducción', '687b1c31-6453-4375-8e66-a2a828319397', 1),
      (2, 'Configuración de Entorno Pro', '687b1c31-6453-4375-8e66-a2a828319397', 2),
      (2, 'Tu primer análisis de datos', '687b1c31-6453-4375-8e66-a2a828319397', 3)
      ON CONFLICT DO NOTHING;
    `);

    console.log("✅ ¡Cirugía exitosa! Columnas y lecciones listas.");
  } catch (err) {
    console.error("❌ Error en la reparación:", err.message);
  } finally {
    await pool.end();
  }
}

fixAll();