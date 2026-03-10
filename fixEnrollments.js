require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixTable() {

  try {

    console.log("🟡 Conectando DB...");

    await pool.query(`DROP TABLE IF EXISTS enrollments`);

    await pool.query(`
      CREATE TABLE enrollments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        course_id VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, course_id)
      );
    `);

    console.log("✅ Tabla enrollments recreada correctamente");

    process.exit();

  } catch (err) {

    console.error("❌ Error:", err);
    process.exit();

  }

}

fixTable();