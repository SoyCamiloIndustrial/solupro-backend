require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const setupQueries = `
-- 1. Usuarios (Aseguramos password_hash)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Cursos
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT
);

-- 3. Inscripciones
CREATE TABLE IF NOT EXISTS user_courses (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    course_id INTEGER,
    UNIQUE(email, course_id)
);

-- 4. Lecciones (Aseguramos order_num)
CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    course_id INTEGER,
    title TEXT NOT NULL,
    bunny_video_id TEXT,
    order_num INTEGER
);

-- 5. Transacciones (Aseguramos columna 'reference')
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    reference TEXT UNIQUE,
    status TEXT,
    amount INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Insertar curso de Excel por defecto (ID 2 como usa tu webhook)
INSERT INTO courses (id, title, description) 
VALUES (2, 'Excel Básico para Negocios', 'Aprende lo esencial de Excel')
ON CONFLICT (id) DO NOTHING;
`;

async function runSetup() {
  try {
    console.log("⏳ Conectando y actualizando base de datos de SoluPro...");
    await pool.query(setupQueries);
    console.log("✅ ¡Base de datos actualizada con éxito!");
  } catch (err) {
    console.error("❌ Error en la actualización:", err);
  } finally {
    await pool.end();
    process.exit();
  }
}

runSetup();