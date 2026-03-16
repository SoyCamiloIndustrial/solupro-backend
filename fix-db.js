require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  try {
    console.log("⏳ Reconstruyendo base de datos de SoluPro...");

    // 1. Usuarios: Aseguramos columna 'password_hash'
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Cursos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT
      );
    `);

    // 3. Inscripciones (user_courses)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_courses (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        course_id INTEGER,
        UNIQUE(email, course_id)
      );
    `);

    // 4. Transacciones: Aseguramos columna 'reference' (¡CRÍTICO!)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        reference TEXT UNIQUE,
        status TEXT,
        amount INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 5. Lecciones: Aseguramos 'order_num' y 'bunny_video_id'
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        course_id INTEGER,
        title TEXT NOT NULL,
        bunny_video_id TEXT,
        order_num INTEGER
      );
    `);

    // 6. Insertar el curso de Excel (ID 2)
    await pool.query(`
      INSERT INTO courses (id, title, description) 
      VALUES (2, 'Excel Básico para Negocios', 'Curso completo desde cero')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("✅ ¡Base de datos blindada y lista!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await pool.end();
  }
}

fix();