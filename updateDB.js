require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateDB() {

  try {

    console.log("🟡 Conectando a PostgreSQL...");

    await pool.query(`
      ALTER TABLE enrollments
      ADD CONSTRAINT unique_user_course
      UNIQUE(user_id, course_id);
    `);

    console.log("✅ Constraint agregada correctamente");

    process.exit();

  } catch (error) {

    console.error("❌ Error:", error);

    process.exit();

  }

}

updateDB();