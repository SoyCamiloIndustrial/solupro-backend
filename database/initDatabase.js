const { Pool } = require("pg")

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function initDatabase() {

  try {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_courses (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        course_id INT REFERENCES courses(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        transaction_id TEXT,
        amount NUMERIC,
        status TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log("Base de datos inicializada correctamente")

  } catch (error) {

    console.error("Error inicializando la base:", error)

  }

}

module.exports = initDatabase