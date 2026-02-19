require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();

// =============================
// CONFIGURACIÓN BASE
// =============================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 4000;

if (!process.env.DATABASE_URL) {
  console.log("⚠️ DATABASE_URL no definida");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

// =============================
// HEALTH CHECK
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
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        course_id INTEGER NOT NULL,
        transaction_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    res.json({ message: "✅ Tablas creadas correctamente" });
  } catch (err) {
    console.error("❌ Error creando tablas:", err);
    res.status(500).json({
      message: "Error creando tablas",
      errorMessage: err.message,
      errorDetail: err
    });
  }
});

// =============================
// GENERAR FIRMA DINÁMICA
// =============================

app.get("/api/signature", (req, res) => {
  try {
    const reference = "order_" + Date.now();
    const amount = "7900000"; // 79.000 COP en centavos
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

// =============================
// CREAR TRANSACCIÓN MANUAL (OPCIONAL)
// =============================

app.post("/api/create-payment", async (req, res) => {
  try {
    const { amount, email, token } = req.body;

    const response = await axios.post(
      "https://production.wompi.co/v1/transactions",
      {
        amount_in_cents: amount,
        currency: "COP",
        reference: "order_" + Date.now(),
        customer_email: email,
        payment_method: {
          type: "CARD",
          token: token,
          installments: 1
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("❌ Error Wompi:", error.response?.data || error.message);
    res.status(500).json({
      error: "Error creando pago",
      detail: error.response?.data || error.message
    });
  }
});

// =============================
// WEBHOOK WOMPI
// =============================

app.post("/api/webhook-wompi", async (req, res) => {
  try {
    console.log("📩 Webhook recibido:", req.body);

    const event = req.body;

    if (
      event?.data?.transaction?.status === "APPROVED"
    ) {
      const transactionId = event.data.transaction.id;
      const email = event.data.transaction.customer_email;

      const userResult = await pool.query(
        "INSERT INTO users(email) VALUES($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id",
        [email]
      );

      const userId = userResult.rows[0].id;

      await pool.query(
        "INSERT INTO enrollments(user_id, course_id, transaction_id, status) VALUES($1, $2, $3, $4)",
        [userId, 1, transactionId, "active"]
      );

      console.log("✅ Enrollment creado para:", email);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error webhook:", err);
    res.status(500).send("Error webhook");
  }
});

// =============================
// INICIAR SERVIDOR
// =============================

app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);

  try {
    await pool.query("SELECT 1");
    console.log("🟢 PostgreSQL conectado");
  } catch (err) {
    console.log("🔴 Error conexión DB:", err.message);
  }
});
