require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// ── 1. CONFIGURACIÓN DE CORS Y CHARSET ────────────────────────────────────
app.use(cors({
  origin: ["https://academia-solupro.com", "https://solupro-frontend.vercel.app", "http://localhost:3000"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Middleware para forzar que todas las respuestas sean UTF-8
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// ── 2. CONEXIÓN A BASE DE DATOS (REPARACIÓN DE ENCODING) ──────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Forzamos al cliente de Postgres a usar UTF8 para evitar símbolos raros
  options: "-c client_encoding=UTF8"
});

// ── 3. RUTAS ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("🚀 Academia SoluPro v7.13 - Encoding Fix Active"));

// WEBHOOK WOMPI
app.post("/api/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const { event, data } = req.body;
    if (event !== "transaction.updated" || data.transaction.status !== "APPROVED") return;

    const { customer_email: email, reference, amount_in_cents: amount } = data.transaction;
    const cleanEmail = email.toLowerCase().trim();
    const courseId = 2; 

    const tempPass = "SoluPro-" + Math.random().toString(36).slice(-6);
    const hash = await bcrypt.hash(tempPass, 10);

    await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) 
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash WHERE users.password_hash IS NULL`,
      [cleanEmail, hash]
    );

    await pool.query(`INSERT INTO user_courses (email, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [cleanEmail, courseId]);

    await resend.emails.send({
      from: 'Academia SoluPro <hola@academia-solupro.com>',
      to: cleanEmail,
      subject: '🚀 ¡Bienvenido a la Academia SoluPro!',
      html: `<p>Acceso generado. <b>Email:</b> ${cleanEmail} <b>Pass:</b> ${tempPass}</p>`
    });

  } catch (err) {
    console.error("❌ Error Webhook:", err.message);
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query(`SELECT * FROM users WHERE LOWER(email) = $1`, [email.toLowerCase().trim()]);
  if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });
  
  const valid = await bcrypt.compare(password, result.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: "Clave errada" });

  const token = jwt.sign({ email: email.toLowerCase().trim() }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
  res.json({ success: true, token });
});

// CURRICULUM: CORRECCIÓN DE TILDES Y ALIAS
app.get("/api/curriculum/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    // Usamos ALIAS para que el front no se rompa (video_url y order_index)
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        bunny_video_id AS video_url, 
        order_num AS order_index 
       FROM lessons 
       WHERE course_id = $1 
       ORDER BY order_num ASC`, 
      [courseId]
    );
    res.json({ success: true, lessons: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 v7.13 desplegado en puerto ${PORT}`));