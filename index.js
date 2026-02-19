require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

/* =====================================
   🔹 DEBUG VARIABLES
===================================== */

console.log("🚨 DATABASE_URL:", process.env.DATABASE_URL);

/* =====================================
   🔹 CONEXIÓN POSTGRES
===================================== */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect()
  .then(() => console.log("🟢 PostgreSQL conectado"))
  .catch((err) => console.error("🔴 Error conexión DB:", err));

/* =====================================
   🔹 HEALTH CHECK
===================================== */

app.get("/", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

/* =====================================
   🔹 CREAR TABLAS (solo ejecutar una vez)
===================================== */

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
        wompi_id TEXT UNIQUE,
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

    res.json({ message: "✅ Tablas creadas correctamente" });

  } catch (error) {
    console.error("❌ ERROR SETUP:", error);
    res.status(500).json({ error: error.message });
  }
});

/* =====================================
   🔹 WEBHOOK WOMPI
===================================== */

app.post("/api/webhook-wompi", async (req, res) => {
  try {
    console.log("📩 Webhook recibido:", JSON.stringify(req.body, null, 2));

    const event = req.body;

    if (!event || !event.data || !event.data.transaction) {
      return res.status(400).json({ error: "Evento inválido" });
    }

    const transaction = event.data.transaction;

    const {
      id: wompiId,
      amount_in_cents,
      status,
      customer_email,
      reference
    } = transaction;

    // 1️⃣ Guardar transacción (evitar duplicado)
    const existing = await pool.query(
      "SELECT id FROM transactions WHERE wompi_id = $1",
      [wompiId]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO transactions (wompi_id, email, amount, status)
         VALUES ($1, $2, $3, $4)`,
        [wompiId, customer_email, amount_in_cents, status]
      );

      console.log("💾 Transacción guardada");
    } else {
      console.log("⚠️ Transacción ya existe");
    }

    // 2️⃣ Si está aprobada → crear enrollment
    if (status === "APPROVED") {

      const enrollmentExists = await pool.query(
        `SELECT id FROM enrollments 
         WHERE email = $1 AND course_id = $2`,
        [customer_email, 1] // temporal curso 1
      );

      if (enrollmentExists.rows.length === 0) {
        await pool.query(
          `INSERT INTO enrollments (email, course_id)
           VALUES ($1, $2)`,
          [customer_email, 1]
        );

        console.log("🎓 Enrollment creado");
      } else {
        console.log("⚠️ Enrollment ya existía");
      }
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error("❌ Error webhook:", error);
    res.status(500).json({ error: "Error procesando webhook" });
  }
});

/* =====================================
   🔹 ENDPOINT PARA VER TRANSACTIONS
===================================== */

app.get("/api/transactions", async (req, res) => {
  const result = await pool.query("SELECT * FROM transactions ORDER BY created_at DESC");
  res.json(result.rows);
});

/* =====================================
   🔹 ENDPOINT PARA VER ENROLLMENTS
===================================== */

app.get("/api/enrollments", async (req, res) => {
  const result = await pool.query("SELECT * FROM enrollments ORDER BY created_at DESC");
  res.json(result.rows);
});

/* =====================================
   🔹 INICIAR SERVIDOR
===================================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});
