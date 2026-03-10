require("dotenv").config();
const pool = require("./db");

async function createTables() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      product_id VARCHAR(100),
      wompi_id VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("✅ Tablas creadas correctamente");

  process.exit();
}

createTables();