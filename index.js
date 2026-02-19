require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// ===============================
// CONFIG BÁSICA
// ===============================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 8080;

// ===============================
// POSTGRESQL
// ===============================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then(() => console.log("🟢 PostgreSQL conectado"))
  .catch(err => console.error("🔴 Error conexión DB:", err));

// ===============================
// FUNCIÓN FIRMA WOMPI
// ===============================

function generateSignature(reference, amountInCents, currency) {
  const integrityKey = process.env.WOMPI_INTEGRITY_KEY;

  const stringToSign =
    reference +
    amountInCents +
    currency +
    integrityKey;

  return crypto
    .createHash("sha256")
    .update(stringToSign)
    .digest("hex");
}

// ===============================
// ROOT
// ===============================

app.get("/", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

// ===============================
// GENERAR FIRMA PARA WIDGET
// ===============================

app.get("/api/signature", (req, res) => {
  try {
    const reference = "order_" + Date.now();
    const amountInCents = 200000; // $2.000 COP
    const currency = "COP";

    const signature = generateSignature(
      reference,
      amountInCents,
      currency
    );

    res.json({
      reference,
      amountInCents,
      currency,
      publicKey: process.env.WOMPI_PUBLIC_KEY,
      signature
    });

  } catch (error) {
    res.status(500).json({ error: "Error generando firma" });
  }
});

// ===============================
// WEBHOOK WOMPI
// ===============================

app.post("/api/webhook-wompi", async (req, res) => {
  try {
    console.log("📩 Webhook recibido:", req.body);

    const event = req.body;

    if (event?.data?.transaction) {
      const tx = event.data.transaction;

      await pool.query(
        `INSERT INTO transactions
        (transaction_id, status, amount_in_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (transaction_id)
        DO UPDATE SET status = EXCLUDED.status`,
        [
          tx.id,
          tx.status,
          tx.amount_in_cents
        ]
      );

      console.log("💾 Transacción guardada:", tx.status);
    }

    res.status(200).send("OK");

  } catch (error) {
    console.error("Error webhook:", error);
    res.status(500).send("Error");
  }
});

// ===============================
// CREAR TABLAS (solo primera vez)
// ===============================

app.get("/api/setup-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        transaction_id TEXT UNIQUE,
        status TEXT,
        amount_in_cents INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    res.json({ message: "✅ Tablas creadas correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creando tablas" });
  }
});

// ===============================
// INICIAR SERVIDOR
// ===============================

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});
