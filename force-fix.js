require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runForceFix() {
  try {
    console.log("⏳ Iniciando cirugía forzada de base de datos...");

    // 1. Forzar columnas en la tabla 'users'
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);

    // 2. Forzar columnas en la tabla 'lessons' (¡Esto arregla las 0 lecciones!)
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS order_num INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS bunny_video_id TEXT;`);

    // 3. Forzar columna 'reference' en 'transactions'
    await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;`);

    // 4. INYECTAR LAS LECCIONES (Si no hay datos, siempre dirá 0)
    // Usamos el ID 2 que es el de tu curso de Excel
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Bienvenido al Beef de Excel', '687b1c31-6453-4375-8e66-a2a828319397', 1),
      (2, 'Configuración Pro de tu entorno', '687b1c31-6453-4375-8e66-a2a828319397', 2),
      (2, 'Tu primera tabla dinámica', '687b1c31-6453-4375-8e66-a2a828319397', 3)
      ON CONFLICT DO NOTHING;
    `);

    console.log("✅ ¡Base de datos reconstruida y con datos inyectados!");
  } catch (err) {
    console.error("❌ Error durante la cirugía:", err.message);
  } finally {
    await pool.end();
  }
}

runForceFix();  