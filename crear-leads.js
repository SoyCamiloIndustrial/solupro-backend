const { Pool } = require('pg');

// Tu cadena de conexión de Railway
const connectionString = "postgresql://postgres:yuKrxFOhBwGzjFvmKCGzEwXzhjrpnCHn@turntable.proxy.rlwy.net:13104/railway";

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function crearTabla() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log("⏳ Conectando a la base de datos...");
    await pool.query(sql);
    console.log("✅ Tabla 'leads' creada exitosamente.");
  } catch (err) {
    console.error("❌ Error al crear la tabla:", err.message);
  } finally {
    await pool.end();
  }
}

crearTabla();