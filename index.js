require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

// =============================
// CONFIGURACIÓN BÁSICA
// =============================

app.use(cors());
app.use(express.json());

// =============================
// CONEXIÓN A POSTGRES (Railway)
// =============================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// =============================
// TEST SERVER
// =============================

app.get("/", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

// =============================
// CREAR TABLAS
// =============================

app.get("/api/setup-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        wompi_id TEXT,
        email TEXT,
        amount INTEGER,
        status TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        email TEXT,
        course_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    res.json({ message: "Tablas creadas correctamente ✅" });

  } catch (error) {
    console.error("Error creando tablas:", error);
    res.status(500).json({ error: "Error creando tablas" });
  }
});

// =============================
// WEBHOOK WOMPI
// =============================

app.post("/api/webhook-wompi", async (req, res) => {
  try {
    const event = req.body.data;

    const wompiId = event.id;
    const amount = event.amount_in_cents;
    const status = event.status;
    const email = event.customer_email;

    console.log("Evento recibido:", wompiId, status);

    // Guardar transacción
    await pool.query(
      "INSERT INTO transactions (wompi_id, email, amount, status) VALUES ($1,$2,$3,$4)",
      [wompiId, email, amount, status]
    );

    // Si fue aprobada, crear acceso
    if (status === "APPROVED") {
      await pool.query(
        "INSERT INTO enrollments (email, course_id) VALUES ($1,$2)",
        [email, 1]
      );

      console.log("Enrollment creado ✅");
    }

    res.status(200).send("OK");

  } catch (error) {
    console.error("Error webhook:", error);
    res.status(500).send("Error");
  }
});

// =============================
// INICIAR SERVIDOR
// =============================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});
