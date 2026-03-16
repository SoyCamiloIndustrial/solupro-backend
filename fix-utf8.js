require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function repair() {
  try {
    console.log("🛠️ Iniciando reparación de caracteres...");
    
    // Lista de correcciones comunes para encoding roto
    const repairs = [
      { wrong: 'Ã¡', right: 'á' },
      { wrong: 'Ã©', right: 'é' },
      { wrong: 'Ã\xAD', right: 'í' }, // í
      { wrong: 'Ã³', right: 'ó' },
      { wrong: 'Ãº', right: 'ú' },
      { wrong: 'Ã±', right: 'ñ' },
      { wrong: 'Â¿', right: '¿' }
    ];

    for (let r of repairs) {
      await pool.query(
        "UPDATE lessons SET title = REPLACE(title, $1, $2) WHERE title LIKE $3",
        [r.wrong, r.right, `%${r.wrong}%`]
      );
    }

    console.log("✅ ¡Limpieza de base de datos completada!");
  } catch (err) {
    console.error("❌ Error reparando:", err.message);
  } finally {
    await pool.end();
  }
}

repair();