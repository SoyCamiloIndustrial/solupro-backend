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
   PUBLIC KEY (Frontend)
====================================== */

app.get("/api/public-key", (req, res) => {
  if (!process.env.WOMPI_PUBLIC_KEY) {
    return res.status(500).json({
      error: "WOMPI_PUBLIC_KEY no configurada"
    });
  }

  res.json({
    publicKey: process.env.WOMPI_PUBLIC_KEY
  });
});

/* ======================================
   SIGNATURE (Widget)
====================================== */

app.get("/api/signature", (req, res) => {
  try {
    const reference = "ref_" + Date.now();
    const amount = "200000"; // 2.000 COP en centavos
    const currency = "COP";

    if (!process.env.WOMPI_INTEGRITY_KEY) {
      return res.status(500).json({
        error: "WOMPI_INTEGRITY_KEY no configurada"
      });
    }

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
    res.status(500).json({ error: "Error generando firma" });
  }
});

/* ======================================
   WEBHOOK WOMPI (CAJA REGISTRADORA)
====================================== */

app.post("/api/wompi-webhook", async (req, res) => {
  try {
    const { event, data, signature, timestamp } = req.body;

    if (!event || !data || !signature || !timestamp) {
      return res.status(400).send("Invalid payload");
    }

    const transaction = data.transaction;

    /* ---------- VALIDAR FIRMA ---------- */

    const stringToSign =
      transaction.id +
      transaction.status +
      transaction.amount_in_cents +
      timestamp +
      process.env.WOMPI_EVENTS_SECRET;

    const expectedSignature = crypto
      .createHash("sha256")
      .update(stringToSign)
      .digest("hex");

    if (expectedSignature !== signature.checksum) {
      console.error("⚠️ Firma inválida");
      return res.status(401).send("Invalid signature");
    }

    /* ---------- SI APROBADO ---------- */

    if (event === "transaction.updated" && transaction.status === "APPROVED") {

      const wompiId = transaction.id;
      const email = transaction.customer_email;
      const amount = transaction.amount_in_cents;
      const status = transaction.status;

      // Evitar duplicados
      const existing = await pool.query(
        "SELECT id FROM transactions WHERE wompi_id = $1",
        [wompiId]
      );

      if (existing.rows.length > 0) {
        console.log("⚠️ Transacción ya registrada.");
        return res.status(200).send("Already processed");
      }

      await pool.query(
        `INSERT INTO transactions (wompi_id, email, amount, status)
         VALUES ($1, $2, $3, $4)`,
        [wompiId, email, amount, status]
      );

      console.log("✅ Pago guardado en DB:", wompiId);
    }

    return res.status(200).send("OK");

  } catch (error) {
    console.error("❌ Error webhook:", error);
    return res.status(500).send("Internal Server Error");
  }
});

/* ======================================
   START SERVER
====================================== */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});