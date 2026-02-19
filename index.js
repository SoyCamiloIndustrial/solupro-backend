require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

/* =============================
   🔎 DEBUG VARIABLES
============================= */

console.log("🚨 DEBUG DATABASE_URL:", process.env.DATABASE_URL);

/* =============================
   🔹 CONEXIÓN A POSTGRES
============================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect()
  .then(() => console.log("🟢 PostgreSQL conectado"))
  .catch(err => console.error("🔴 Error conexión DB:", err));

/* =============================
   🔹 HEALTH CHECK
============================= */

app.get("/", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

/* =============================
   🔹 SETUP DB
============================= */

app.get("/api/setup-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        wompi_id TEXT,
        email TEXT,
        amount INTEGER,
        status TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        email TEXT,
        course_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    res.json({ message: "Tablas creadas correctamente ✅" });

  } catch (error) {
    console.error("❌ Error creando tablas:", error);
    res.status(500).json({ error: error.message });
  }
});

/* =============================
   🔹 SERVIDOR
============================= */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});
