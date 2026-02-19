require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   🔹 SERVIR FRONTEND PRIMERO
================================ */
app.use(express.static(path.join(__dirname, "public")));

/* ===============================
   🔹 RUTA BASE SOLO PARA API
================================ */
app.get("/api", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

/* ===============================
   🔹 CONEXIÓN POSTGRES
================================ */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log("🟢 PostgreSQL conectado"))
  .catch(err => console.error("🔴 Error DB:", err));

/* ===============================
   🔹 FIRMA WOMPI (2.000 COP)
================================ */
app.get("/api/signature", (req, res) => {

  const reference = "order_" + Date.now();
  const amountInCents = 200000; // 2.000 COP
  const currency = "COP";

  const stringToSign =
    reference +
    amountInCents +
    currency +
    process.env.WOMPI_INTEGRITY_KEY;

  const signature = crypto
    .createHash("sha256")
    .update(stringToSign)
    .digest("hex");

  res.json({
    reference,
    amountInCents,
    currency,
    signature,
    publicKey: process.env.WOMPI_PUBLIC_KEY
  });
});

/* ===============================
   🔹 WEBHOOK
================================ */
app.post("/api/webhook-wompi", async (req, res) => {
  console.log("📩 Webhook recibido:");
  console.log(JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

/* ===============================
   🔹 START SERVER
================================ */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
