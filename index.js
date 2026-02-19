require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

/*
====================================
DEBUG VARIABLES
====================================
*/

console.log("🔍 DEBUG WOMPI_PUBLIC_KEY:", process.env.WOMPI_PUBLIC_KEY);
console.log("🔍 DEBUG WOMPI_INTEGRITY_KEY:", process.env.WOMPI_INTEGRITY_KEY);

/*
====================================
CONFIG
====================================
*/

const PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY;
const INTEGRITY_KEY = process.env.WOMPI_INTEGRITY_KEY;

/*
====================================
GENERAR FIRMA
====================================
*/

function generateSignature(reference, amountInCents, currency) {
  const stringToSign = reference + amountInCents + currency + INTEGRITY_KEY;

  return crypto
    .createHash("sha256")
    .update(stringToSign)
    .digest("hex");
}

/*
====================================
ENDPOINT SIGNATURE
====================================
*/

app.get("/api/signature", (req, res) => {
  try {
    if (!PUBLIC_KEY) {
      return res.status(500).json({
        error: "WOMPI_PUBLIC_KEY no configurada en Railway"
      });
    }

    if (!INTEGRITY_KEY) {
      return res.status(500).json({
        error: "WOMPI_INTEGRITY_KEY no configurada en Railway"
      });
    }

    const reference = "order_" + Date.now();
    const amountInCents = 200000; // 2.000 COP
    const currency = "COP";

    const signature = generateSignature(reference, amountInCents, currency);

    res.json({
      reference,
      amountInCents,
      currency,
      publicKey: PUBLIC_KEY,
      signature
    });

  } catch (error) {
    console.error("❌ Error generando firma:", error);
    res.status(500).json({
      error: "Error generando firma"
    });
  }
});

/*
====================================
ROOT
====================================
*/

app.get("/", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

/*
====================================
START SERVER
====================================
*/

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});
