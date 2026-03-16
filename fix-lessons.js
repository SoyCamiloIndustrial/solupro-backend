require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function finalFix() {
  try {
    console.log("⏳ Iniciando reparación de emergencia en las lecciones...");

    // 1. Asegurar columnas en la tabla 'lessons'
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS order_num INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS bunny_video_id TEXT;`);

    // 2. Limpiar lecciones viejas para evitar conflictos
    await pool.query(`DELETE FROM lessons WHERE course_id = 2;`);

    // 3. INYECTAR LAS LECCIONES REALES (ID 2 es Excel)
    // Usamos el ID de Bunny Video que ya tienes configurado
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Módulo 1: Introducción al Beef de Excel', '687b1c31-6453-4375-8e66-a2a828319397', 1),
      (2, 'Módulo 2: Configuración de Entorno Analítico', '687b1c31-6453-4375-8e66-a2a828319397', 2),
      (2, 'Módulo 3: Tu primer Dashboard profesional', '687b1c31-6453-4375-8e66-a2a828319397', 3)
    `);

    console.log("✅ ¡Cirugía terminada! Las lecciones ya están vinculadas al curso ID 2.");
  } catch (err) {
    console.error("❌ Error en la cirugía:", err.message);
  } finally {
    await pool.end();
  }
}

finalFix(); 