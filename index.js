require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

/* =============================
   CONFIGURACIÓN BASE
============================= */

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 4000;

/* =============================
   CONEXIÓN POSTGRES
============================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

pool.connect()
  .then(() => console.log("🟢 PostgreSQL conectado"))
  .catch(err => console.error("🔴 Error conexión DB:", err.message));

/* =============================
   HEALTH CHECK
============================= */

app.get("/", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

/* =============================
   SETUP DB
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

/* =============================
   FIRMA DINÁMICA - $2.000 COP
============================= */

app.get("/api/signature", (req, res) => {
  try {
    const reference = "order_" + Date.now();

    // 🔥 2.000 COP = 200000 centavos
    const amount = "200000";
    const currency = "COP";

    const stringToSign =
      reference +
      amount +
      currency +
      process.env.WOMPI_INTEGRITY_KEY;

    const signature = crypto
      .createHash("sha256")
      .update(stringToSign)
      .digest("hex");

    res.json({
      reference,
      amount,
      currency,
      signature
    });

  } catch (err) {
    console.error("❌ Error generando firma:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =============================
   WEBHOOK WOMPI
============================= */

app.post("/api/webhook-wompi", async (req, res) => {
  try {
    console.log("📩 Webhook recibido:", JSON.stringify(req.body, null, 2));

    const event = req.body;

    if (!event?.data?.transaction) {
      return res.status(200).send("Evento ignorado");
    }

    const tx = event.data.transaction;

    const {
      id: wompiId,
      amount_in_cents,
      status,
      customer_email
    } = tx;

    await pool.query(
      `INSERT INTO transactions (wompi_id, email, amount, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (wompi_id) DO NOTHING`,
      [wompiId, customer_email, amount_in_cents, status]
    );

    if (status === "APPROVED") {

      await pool.query(
        `INSERT INTO enrollments (email, course_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [customer_email, 1]
      );

      console.log("🎓 Enrollment creado");
    }

    res.status(200).send("OK");

  } catch (error) {
    console.error("❌ Error webhook:", error);
    res.status(500).send("Error webhook");
  }
});

/* =============================
   ENDPOINTS DE CONSULTA
============================= */

app.get("/api/transactions", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM transactions ORDER BY created_at DESC"
  );
  res.json(result.rows);
});

app.get("/api/enrollments", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM enrollments ORDER BY created_at DESC"
  );
  res.json(result.rows);
});

/* =============================
   INICIAR SERVIDOR
============================= */

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
