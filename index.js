require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// ── CONFIGURACIÓN CORS ────────────────────────────────────────────────────
app.use(cors({
  origin: ["https://academia-solupro.com", "https://solupro-frontend.vercel.app", "http://localhost:3000"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ── CONEXIÓN BASE DE DATOS ───────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── RUTA DE PRUEBA ────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("🚀 Academia SoluPro API v7.9 Online"));

// ── WEBHOOK WOMPI (PAGOS) ────────────────────────────────────────────────
app.post("/api/webhook", async (req, res) => {
  res.sendStatus(200); // Responder rápido a Wompi para evitar bloqueos

  try {
    const { event, data } = req.body;
    if (event !== "transaction.updated" || data.transaction.status !== "APPROVED") return;

    const { customer_email: email, reference, amount_in_cents: amount } = data.transaction;
    const cleanEmail = email.toLowerCase().trim();
    const courseId = 2; // ID de Excel

    // 1. Generar credenciales
    const tempPass = "SoluPro-" + Math.random().toString(36).slice(-6);
    const hash = await bcrypt.hash(tempPass, 10);

    // 2. Base de Datos (Prioridad total)
    console.log(`🛠️ Procesando acceso para: ${cleanEmail}`);
    
    // Crear/Actualizar usuario
    await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) 
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash WHERE users.password_hash IS NULL`,
      [cleanEmail, hash]
    );

    // Asignar curso e insertar transacción
    await pool.query(`INSERT INTO user_courses (email, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [cleanEmail, courseId]);
    await pool.query(`INSERT INTO transactions (email, reference, status, amount) VALUES ($1, $2, 'APPROVED', $3) ON CONFLICT DO NOTHING`, [cleanEmail, reference, amount]);

    console.log(`✅ DB lista para ${cleanEmail}. Enviando correo...`);

    // 3. Envío de Correo (CORREGIDO: Sin el "send.")
    resend.emails.send({
      from: 'Academia SoluPro <hola@academia-solupro.com>', 
      to: cleanEmail,
      subject: '🚀 ¡Bienvenido a la Academia SoluPro!',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #10b981;">¡Acceso Concedido!</h2>
          <p>Tu pago ha sido procesado. Ya puedes entrar a ver tus clases.</p>
          <p><strong>Email:</strong> ${cleanEmail}</p>
          <p><strong>Contraseña:</strong> ${tempPass}</p>
          <br>
          <a href="https://academia-solupro.com/login" style="background:#10b981; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Entrar al Panel</a>
        </div>`
    }).catch(e => console.error("❌ Error Resend:", e.message));

  } catch (err) {
    console.error("❌ Error Webhook:", err.message);
  }
});

// ── LOGIN Y AUTOLOGIN ─────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query(`SELECT * FROM users WHERE LOWER(email) = $1`, [email.toLowerCase().trim()]);
  if (result.rows.length === 0) return res.status(401).json({ error: "No existe" });
  
  const valid = await bcrypt.compare(password, result.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: "Clave errada" });

  const token = jwt.sign({ email: email.toLowerCase().trim() }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
  res.json({ success: true, token });
});

app.post("/api/auto-login", (req, res) => {
  const token = jwt.sign({ email: req.body.email.toLowerCase().trim() }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
  res.json({ success: true, token });
});

// ── CURSOS Y LECCIONES ────────────────────────────────────────────────────
app.get("/api/my-courses", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const { email } = jwt.verify(token, process.env.JWT_SECRET || "secret");
    const result = await pool.query(
      `SELECT c.* FROM user_courses uc JOIN courses c ON c.id = uc.course_id WHERE LOWER(uc.email) = $1`, 
      [email.toLowerCase().trim()]
    );
    res.json({ success: true, courses: result.rows });
  } catch (e) { res.status(401).json({ error: "Error" }); }
});

app.get("/api/curriculum/:courseId", async (req, res) => {
  try {
    // Usamos order_num para el orden
    const result = await pool.query(
      `SELECT * FROM lessons WHERE course_id = $1 ORDER BY order_num ASC`, 
      [req.params.courseId]
    );
    res.json({ success: true, lessons: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 SoluPro v7.9 en puerto ${PORT}`));