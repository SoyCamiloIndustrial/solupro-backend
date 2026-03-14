const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  const client = await pool.connect();
  try {
    console.log("🚀 Creando tablas en Railway...");

    // Tabla módulos
    await client.query(`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id),
        title VARCHAR(255) NOT NULL,
        order_num INTEGER NOT NULL
      );
    `);
    console.log("✅ Tabla modules lista");

    // Tabla lecciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        module_id INTEGER REFERENCES modules(id),
        title VARCHAR(255) NOT NULL,
        bunny_video_id VARCHAR(255),
        order_num INTEGER NOT NULL
      );
    `);
    console.log("✅ Tabla lessons lista");

    // Curso Excel Básico course_id=2
    await client.query(`
      INSERT INTO courses (id, title, description)
      VALUES (2, 'Excel Básico: El Beef 🥩', 'Domina Excel por lo que cuesta un buen corte de carne.')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log("✅ Curso Excel Básico registrado (course_id=2)");

    // Módulos del curso
    await client.query(`
      INSERT INTO modules (course_id, title, order_num) VALUES
      (2, 'Módulo 1 - Fundamentos', 1),
      (2, 'Módulo 2 - Formatos', 2),
      (2, 'Módulo 3 - Fórmulas', 3)
      ON CONFLICT DO NOTHING;
    `);
    console.log("✅ Módulos insertados");

    // Verificar
    const modules = await client.query('SELECT * FROM modules WHERE course_id = 2');
    console.log("\n📋 Módulos creados:");
    console.table(modules.rows);

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    client.release();
    await pool.end();
    console.log("\n🏁 Listo. Ahora ejecuta el INSERT de lessons cuando tengas los IDs de Bunny.");
  }
}

createTables();