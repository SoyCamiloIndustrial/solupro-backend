require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function masterFix() {
  try {
    console.log("🚀 Iniciando reconstrucción total de SoluPro...");

    // 1. FORZAR COLUMNAS EN LESSONS (Lo que causa las 0 lecciones)
    console.log("🔨 Ajustando tabla de lecciones...");
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS order_num INTEGER;`);
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS bunny_video_id TEXT;`);

    // 2. FORZAR COLUMNAS EN USERS Y TRANSACTIONS
    console.log("🔨 Ajustando usuarios y transacciones...");
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
    await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;`);

    // 3. LIMPIAR E INYECTAR LOS VIDEOS REALES (Módulo de Excel ID 2)
    console.log("📥 Inyectando el contenido del curso...");
    // Borramos lo viejo por si acaso para no duplicar
    await pool.query(`DELETE FROM lessons WHERE course_id = 2;`);
    
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Bienvenido al Beef: Introducción Pro', '687b1c31-6453-4375-8e66-a2a828319397', 1),
      (2, 'Configuración de Excel para Analistas', '687b1c31-6453-4375-8e66-a2a828319397', 2),
      (2, 'Tu primer Dashboard en minutos', '687b1c31-6453-4375-8e66-a2a828319397', 3)
    `);

    console.log("✅ ¡SISTEMA RESTAURADO! Ya puedes revisar el panel.");
  } catch (err) {
    console.error("❌ Error en la cirugía:", err.message);
  } finally {
    await pool.end();
  }
}

masterFix();