const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    // Agregar a users
    await client.query(
      `INSERT INTO users (email) VALUES ($1) ON CONFLICT DO NOTHING`,
      ['ing.camiloindustrial4.0@gmail.com']
    );

    // Dar acceso al curso Excel (course_id=2)
    await client.query(
      `INSERT INTO user_courses (email, course_id) VALUES ($1, 2) ON CONFLICT DO NOTHING`,
      ['ing.camiloindustrial4.0@gmail.com']
    );

    console.log("✅ Usuario de prueba listo:");
    console.log("   Email: ing.camiloindustrial4.0@gmail.com");
    console.log("   Curso: Excel Básico (course_id=2)");

    const check = await client.query(
      `SELECT uc.email, c.title FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE uc.email = $1`,
      ['ing.camiloindustrial4.0@gmail.com']
    );
    console.log("\n📋 Accesos del usuario:");
    console.table(check.rows);

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();