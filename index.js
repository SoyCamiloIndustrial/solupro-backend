require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

/* ======================================
   DEBUG VARIABLES
====================================== */

console.log("🔎 WOMPI_PUBLIC_KEY:", process.env.WOMPI_PUBLIC_KEY ? "OK" : "NO DEFINIDA");
console.log("🔎 WOMPI_INTEGRITY_KEY:", process.env.WOMPI_INTEGRITY_KEY ? "OK" : "NO DEFINIDA");

/* ======================================
   ROOT
====================================== */

app.get("/", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

/* ======================================
   PUBLIC KEY ENDPOINT
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
   SIGNATURE ENDPOINT
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
   START SERVER
====================================== */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});
