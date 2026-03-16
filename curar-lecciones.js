require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixLessons() {
  try {
    console.log("⏳ Ajustando tabla de lecciones para que el panel funcione...");

    // 1. Asegurar que la tabla lessons tenga TODO lo que el código pide
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        course_id INTEGER, -- ¡CRÍTICO: El error dice que falta esto!
        title TEXT NOT NULL,
        bunny_video_id TEXT,
        order_num INTEGER -- El código v7.3 usa order_num, no order_index
      );
    `);

    // 2. Insertar lecciones de prueba para que el usuario vea algo
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Bienvenido al Beef de Excel', '687b1c31-6453-4375-8e66-a2a828319397', 1),
      (2, 'Configuración inicial', '687b1c31-6453-4375-8e66-a2a828319397', 2)
      ON CONFLICT DO NOTHING;
    `);

    console.log("✅ ¡Tabla de lecciones reparada! Ya deberían verse los videos.");
  } catch (err) {
    console.error("❌ Error reparando lecciones:", err.message);
  } finally {
    await pool.end();
  }
}

fixLessons();