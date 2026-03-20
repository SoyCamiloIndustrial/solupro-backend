// setup-db.js
const { Pool } = require('pg');

const connectionString = "postgresql://postgres:yuKrxFOhBwGzjFvmKCGzEwXzhjrpnCHn@turntable.proxy.rlwy.net:13104/railway"; 

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Vital para Railway
  }
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

async function setup() {
  try {
    console.log("⏳ Conectando a Railway...");
    await pool.query(createTableQuery);
    console.log("✅ ¡Tabla 'leads' creada exitosamente!");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await pool.end();
  }
}

setup();