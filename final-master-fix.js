require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runFix() {
  try {
    console.log("🚀 Iniciando reparación estructural definitiva...");

    // 1. Asegurar columnas en todas las tablas
    const queries = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;",
      "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;",
      "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id INTEGER;",
      "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS order_num INTEGER;",
      "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS bunny_video_id TEXT;"
    ];

    for (let q of queries) {
      try { await pool.query(q); } catch (e) { console.log("Info:", e.message); }
    }

    // 2. Limpiar e Inyectar las lecciones para el curso de Excel (ID 2)
    console.log("📥 Cargando contenido al curso de Excel...");
    await pool.query("DELETE FROM lessons WHERE course_id = 2;");
    
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Bienvenido al Beef de Excel', '687b1c31-6453-4375-8e66-a2a828319397', 1),
      (2, 'Configuración Pro', '687b1c31-6453-4375-8e66-a2a828319397', 2),
      (2, 'Tu primer Dashboard', '687b1c31-6453-4375-8e66-a2a828319397', 3)
    `);

    console.log("✅ ¡Base de datos y contenido listos!");
  } catch (err) {
    console.error("❌ Error crítico:", err.message);
  } finally {
    await pool.end();
  }
}

runFix();