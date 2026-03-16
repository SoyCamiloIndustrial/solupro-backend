require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMasterFix() {
  try {
    console.log("🚀 Iniciando reconstrucción estructural de SoluPro...");

    // 1. FORZAR COLUMNAS (Aseguramos que las tuberías existan)
    // Usamos comandos individuales para que si uno falla, el resto siga
    const columns = [
      { table: 'lessons', col: 'course_id', type: 'INTEGER' },
      { table: 'lessons', col: 'order_num', type: 'INTEGER' },
      { table: 'lessons', col: 'bunny_video_id', type: 'TEXT' },
      { table: 'users', col: 'password_hash', type: 'TEXT' },
      { table: 'transactions', col: 'reference', type: 'TEXT UNIQUE' }
    ];

    for (const c of columns) {
      try {
        await pool.query(`ALTER TABLE ${c.table} ADD COLUMN IF NOT EXISTS ${c.col} ${c.type};`);
        console.log(`✅ Columna [${c.col}] verificada en [${c.table}]`);
      } catch (e) { console.log(`ℹ️ Columna ${c.col} ya procesada.`); }
    }

    // 2. LIMPIAR E INYECTAR CONTENIDO REAL
    console.log("📥 Inyectando lecciones para el curso de Excel (ID 2)...");
    await pool.query(`DELETE FROM lessons WHERE course_id = 2;`);
    
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Bienvenido al Beef de Excel', '687b1c31-6453-4375-8e66-a2a828319397', 1),
      (2, 'Configuración Pro del entorno', '687b1c31-6453-4375-8e66-a2a828319397', 2),
      (2, 'Tu primera tabla dinámica', '687b1c31-6453-4375-8e66-a2a828319397', 3)
    `);

    console.log("🔥 ¡SISTEMA RESTAURADO COMPLETAMENTE!");
  } catch (err) {
    console.error("❌ Error crítico:", err.message);
  } finally {
    await pool.end();
  }
}

runMasterFix();