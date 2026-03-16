require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function limpiar() {
  try {
    console.log("🧹 Iniciando limpieza de tildes en la base de datos...");
    
    // Mapeo de errores comunes de encoding
    const correcciones = [
      { mal: 'Ã¡', bien: 'á' },
      { mal: 'Ã©', bien: 'é' },
      { mal: 'Ã\xAD', bien: 'í' }, 
      { mal: 'Ã³', bien: 'ó' },
      { mal: 'Ãº', bien: 'ú' },
      { mal: 'Ã±', bien: 'ñ' },
      { mal: 'Ã\x81', bien: 'Á' },
      { mal: 'Ã\x89', bien: 'É' },
      { mal: 'Ã\x8D', bien: 'Í' },
      { mal: 'Ã\x93', bien: 'Ó' },
      { mal: 'Ã\x9A', bien: 'Ú' },
      { mal: 'Ã\x91', bien: 'Ñ' }
    ];

    for (let c of correcciones) {
      const res = await pool.query(
        "UPDATE lessons SET title = REPLACE(title, $1, $2) WHERE title LIKE $3",
        [c.mal, c.bien, `%${c.mal}%`]
      );
      if(res.rowCount > 0) console.log(`✅ Corregido: ${c.mal} -> ${c.bien} (${res.rowCount} filas)`);
    }

    console.log("✨ ¡Base de datos impecable!");
  } catch (err) {
    console.error("❌ Error limpiando:", err.message);
  } finally {
    await pool.end();
  }
}

limpiar();
