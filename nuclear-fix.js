require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function nuclear() {
  try {
    console.log("🚀 Iniciando reconstrucción estructural de SoluPro...");

    // 1. LIMPIEZA Y CREACIÓN DE TABLAS (Aseguramos que no haya basura)
    console.log("🔨 Preparando estructura de datos...");
    
    // Tabla de Usuarios: Aseguramos password_hash
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    );`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);

    // Tabla de Lecciones: EL CORAZÓN DEL PROBLEMA
    // La borramos y recreamos para que no haya errores de "column does not exist"
    await pool.query(`DROP TABLE IF EXISTS lessons CASCADE;`);
    await pool.query(`CREATE TABLE lessons (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        bunny_video_id TEXT,
        order_num INTEGER NOT NULL
    );`);

    // Tabla de Transacciones: Aseguramos la columna 'reference'
    await pool.query(`CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        reference TEXT UNIQUE,
        status TEXT,
        amount INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
    );`);
    await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;`);

    // 2. INYECCIÓN DE CONTENIDO (Módulo de Excel ID 2)
    console.log("📥 Inyectando las lecciones del 'Beef'...");
    
    await pool.query(`
      INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
      VALUES 
      (2, 'Bienvenido al Beef: Introducción Pro', '687b1c31-6453-4375-8e66-a2a828319397', 1),
      (2, 'Configuración de Excel para Analistas', '687b1c31-6453-4375-8e66-a2a828319397', 2),
      (2, 'Tu primer Dashboard en minutos', '687b1c31-6453-4375-8e66-a2a828319397', 3),
      (2, 'Análisis de datos aplicado', '687b1c31-6453-4375-8e66-a2a828319397', 4)
    `);

    console.log("🔥 ¡TODO LISTO! Base de datos sincronizada con el código v7.3.");
  } catch (err) {
    console.error("❌ Error en la cirugía nuclear:", err.message);
  } finally {
    await pool.end();
  }
}

nuclear();