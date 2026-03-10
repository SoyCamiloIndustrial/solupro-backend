require("dotenv").config();
const pool = require("./db");

async function fixTable() {

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password VARCHAR(255);
  `);

  console.log("✅ Columna password agregada");

  process.exit();
}

fixTable();