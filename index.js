require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// =============================
// HEALTH CHECK
// =============================

app.get("/", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

// =============================
// GENERAR FIRMA CORRECTA WOMPI
// =============================

app.get("/api/signature", (req, res) => {

  const { reference, amount, currency } = req.query;

  if (!reference || !amount || !currency) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  const integrityKey = process.env.WOMPI_INTEGRITY_KEY;

  // 🔥 IMPORTANTE: TODO COMO STRING EXACTO
  const stringToSign = `${reference}${amount}${currency}${integrityKey}`;

  const signature = crypto
    .createHash("sha256")
    .update(stringToSign)
    .digest("hex");

  console.log("🟢 Firma generada correctamente");

  res.json({
    signature
  });

});

// =============================
// WEBHOOK
// =============================

app.post("/api/webhook-wompi", (req, res) => {
  console.log("📩 Webhook recibido:", req.body);
  res.status(200).send("OK");
});

// =============================
// START SERVER
// =============================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
