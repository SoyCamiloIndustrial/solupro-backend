const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await pool.query(
    `INSERT INTO user_courses (email, course_id) VALUES ($1, 2) ON CONFLICT DO NOTHING`,
    ['soluprosoluciones@gmail.com']
  );
  console.log("✅ Curso asignado");
  await pool.end();
}
main();