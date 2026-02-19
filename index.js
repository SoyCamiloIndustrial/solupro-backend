require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

/* ================================
   🔹 CONEXIÓN A POSTGRESQL
================================ */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect()
  .then(() => console.log("🟢 PostgreSQL conectado"))
  .catch(err => console.error("🔴 Error conexión DB:", err));


/* ================================
   🔹 FUNCIÓN GENERAR FIRMA WOMPI
================================ */

function generateSignature(reference, amount, currency) {
  const integrityKey = process.env.WOMPI_INTEGRITY_KEY;
  const stringToSign = reference + amount + currency + integrityKey;

  return crypto
    .createHash("sha256")
    .update(stringToSign)
    .digest("hex");
}


/* ================================
   🔹 ENDPOINT FIRMA
================================ */

app.get("/api/signature", (req, res) => {
  const reference = "order_" + Date.now();
  const amount = "7900000"; // ejemplo
  const currency = "COP";

  const signature = generateSignature(reference, amount, currency);

  res.json({ reference, amount, currency, signature });
});


/* ================================
   🔹 ENDPOINT CREAR TABLAS (TEMPORAL)
================================ */

app.get("/api/setup-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        transaction_id VARCHAR(150),
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    res.json({ message: "✅ Tablas creadas correctamente" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando tablas" });
  }
});


/* ================================
   🔹 WEBHOOK WOMPI
================================ */

app.post("/api/webhook-wompi", async (req, res) => {
  try {
    console.log("📩 Webhook recibido");

    const event = req.body;

    if (event?.data?.transaction?.id) {

      const transactionId = event.data.transaction.id;

      // Consultar estado real en Wompi
      const response = await axios.get(
        `https://production.wompi.co/v1/transactions/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`
          }
        }
      );

      const transaction = response.data.data;

      console.log("🔎 Estado real:", transaction.status);

      if (transaction.status === "APPROVED") {

        // Ejemplo simple (luego lo mejoramos con usuario real)
        await pool.query(`
          INSERT INTO enrollments (user_id, course_id, transaction_id, status)
          VALUES ($1, $2, $3, $4)
        `, [1, 1, transaction.id, transaction.status]);

        console.log("✅ Enrollment guardado en DB");
      }
    }

    res.status(200).send("OK");

  } catch (error) {
    console.error("Error en webhook:", error.message);
    res.status(500).send("Error");
  }
});


/* ================================
   🔹 HEALTH CHECK
================================ */

app.get("/", (req, res) => {
  res.json({ message: "🚀 SoluPro API funcionando" });
});


/* ================================
   🔹 SERVIDOR
================================ */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});
