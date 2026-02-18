require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

// =============================
// CONFIGURACIÓN BÁSICA
// =============================

app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

console.log("WOMPI PRIVATE:", process.env.WOMPI_PRIVATE_KEY ? "OK" : "NO CARGADA");
console.log("WOMPI INTEGRITY:", process.env.WOMPI_INTEGRITY_KEY ? "OK" : "NO CARGADA");

// =============================
// MEMORIA TEMPORAL (SIMULA DB)
// =============================

let transactions = [];

// =============================
// FUNCIÓN PARA GENERAR FIRMA
// =============================

function generateSignature(reference, amount, currency) {
  const integrityKey = process.env.WOMPI_INTEGRITY_KEY;
  const stringToSign = reference + amount + currency + integrityKey;

  return crypto
    .createHash("sha256")
    .update(stringToSign)
    .digest("hex");
}

// =============================
// ENDPOINT PARA GENERAR FIRMA
// =============================

app.get("/api/signature", (req, res) => {
  const reference = "order_" + Date.now();
  const amount = "7900000"; // 79.000 COP en centavos
  const currency = "COP";

  const signature = generateSignature(reference, amount, currency);

  res.json({
    reference,
    amount,
    currency,
    signature
  });
});

// =============================
// WEBHOOK WOMPI (PROFESIONAL)
// =============================

app.post("/api/webhook-wompi", async (req, res) => {
  try {
    console.log("📩 Webhook recibido:", JSON.stringify(req.body, null, 2));

    const event = req.body.event;
    const transaction = req.body.data?.transaction;

    if (!transaction) {
      return res.status(400).send("No transaction data");
    }

    const transactionId = transaction.id;

    // 🔐 Validar estado REAL contra Wompi
    const response = await axios.get(
      `https://production.wompi.co/v1/transactions/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`
        }
      }
    );

    const realData = response.data.data;
    const realStatus = realData.status;
    const reference = realData.reference;
    const amount = realData.amount_in_cents;

    console.log("🔎 Estado real desde Wompi:", realStatus);

    if (realStatus === "APPROVED") {
      console.log("✅ Pago aprobado para:", reference);

      // Simulación de guardar en DB
      transactions.push({
        transactionId,
        reference,
        amount,
        status: realStatus,
        date: new Date()
      });

      console.log("📦 Transacciones guardadas:");
      console.log(transactions);
    }

    res.status(200).send("OK");

  } catch (error) {
    console.error("❌ Error en webhook:", error.response?.data || error.message);
    res.status(500).send("Error");
  }
});

// =============================
// ENDPOINT PARA VER TRANSACCIONES (DEBUG)
// =============================

app.get("/api/transactions", (req, res) => {
  res.json(transactions);
});

// =============================
// INICIAR SERVIDOR
// =============================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});
