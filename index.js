require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

/* ======================================
   DEBUG VARIABLES
====================================== */

console.log("🔎 WOMPI_PUBLIC_KEY:", process.env.WOMPI_PUBLIC_KEY ? "OK" : "NO DEFINIDA");
console.log("🔎 WOMPI_INTEGRITY_KEY:", process.env.WOMPI_INTEGRITY_KEY ? "OK" : "NO DEFINIDA");
console.log("🔎 WOMPI_EVENTS_SECRET:", process.env.WOMPI_EVENTS_SECRET ? "OK" : "NO DEFINIDA");

/* ======================================
   ROOT
====================================== */

app.get("/", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

/* ======================================
   PUBLIC KEY
====================================== */

app.get("/api/public-key", (req, res) => {
  if (!process.env.WOMPI_PUBLIC_KEY) {
    return res.status(500).json({
      error: "WOMPI_PUBLIC_KEY no configurada en Railway"
    });
  }

  res.json({
    publicKey: process.env.WOMPI_PUBLIC_KEY
  });
});

/* ======================================
   SIGNATURE
====================================== */

app.get("/api/signature", (req, res) => {
  try {
    const reference = "ref_" + Date.now();
    const amount = "200000"; // 2.000 COP en centavos
    const currency = "COP";

    const integrityKey = process.env.WOMPI_INTEGRITY_KEY;

    if (!integrityKey) {
      return res.status(500).json({
        error: "WOMPI_INTEGRITY_KEY no configurada"
      });
    }

    const stringToSign = reference + amount + currency + integrityKey;

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
    console.error(err);
    res.status(500).json({ error: "Error generando firma" });
  }
});

/* ======================================
   WEBHOOK WOMPI
====================================== */

app.post("/api/wompi-webhook", async (req, res) => {
  try {
    const { event, data, signature, timestamp } = req.body;

    if (!event || !data) {
      return res.status(400).send("Invalid payload");
    }

    const transaction = data.transaction;

    if (!transaction) {
      return res.status(400).send("No transaction data");
    }

    const eventsSecret = process.env.WOMPI_EVENTS_SECRET;

    if (!eventsSecret) {
      console.error("❌ WOMPI_EVENTS_SECRET no definido");
      return res.status(500).send("Server config error");
    }

    // 🔐 Validación firma webhook
    const stringToSign =
      transaction.id +
      transaction.status +
      transaction.amount_in_cents +
      timestamp +
      eventsSecret;

    const hash = crypto
      .createHash("sha256")
      .update(stringToSign)
      .digest("hex");

    if (hash !== signature?.checksum) {
      console.error("⚠️ Firma inválida");
      return res.status(401).send("Invalid signature");
    }

    console.log("✅ Webhook válido recibido:", transaction.status);

    // 💾 Guardar en base de datos
    await pool.query(
      `INSERT INTO transactions (wompi_id, email, amount, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (wompi_id)
       DO UPDATE SET status = EXCLUDED.status`,
      [
        transaction.id,
        transaction.customer_email,
        transaction.amount_in_cents,
        transaction.status
      ]
    );

    res.status(200).send("OK");

  } catch (error) {
    console.error("❌ Error webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});

/* ======================================
   MIS CURSOS
====================================== */

app.get("/api/my-courses/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const result = await pool.query(
      `SELECT wompi_id, amount, status, created_at
       FROM transactions
       WHERE email = $1
       AND status = 'APPROVED'
       ORDER BY created_at DESC`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No tienes cursos activos aún."
      });
    }

    res.status(200).json({
      success: true,
      message: "¡Bienvenido a tus cursos!",
      courses: result.rows
    });

  } catch (error) {
    console.error("❌ Error buscando cursos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ======================================
   START SERVER
====================================== */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});