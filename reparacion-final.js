require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function reparacion() {
  try {
    console.log("⏳ Forzando actualización de columnas en SoluPro...");

    // 1. Agregar columnas faltantes a 'lessons' si no existen
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS order_num INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS bunny_video_id TEXT;`);

    // 2. Agregar columna 'reference' a 'transactions' (lo que falló en los logs)
    await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;`);

    // 3. Insertar datos de prueba para que el curso ID 2 funcione
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Módulo 1: El inicio del Beef', 'ID_VIDEO_1', 1),
      (2, 'Módulo 2: Configuración Pro', 'ID_VIDEO_2', 2)
      ON CONFLICT DO NOTHING;
    `);

    console.log("✅ ¡Columnas inyectadas con éxito! El panel ya tiene dónde leer.");
  } catch (err) {
    console.error("❌ Error en la cirugía:", err.message);
  } finally {
    await pool.end();
  }
}

reparacion();