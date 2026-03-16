require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
// ── FIX #1: Instancia de Resend con la API key correcta ──────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// ── CONFIGURACIÓN DE MIDDLEWARES ──────────────────────────────────────────
app.use(cors({
  origin: [
    "https://academia-solupro.com",
    "https://solupro-frontend.vercel.app",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ── CONEXIÓN A BASE DE DATOS ──────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── RUTA DE INICIO ────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("🚀 Academia SoluPro API v7.11 Online"));

// ── WEBHOOK WOMPI (PROCESAMIENTO DE PAGOS) ────────────────────────────────
app.post("/api/webhook", async (req, res) => {
  res.sendStatus(200); // Respuesta rápida para Wompi

  try {
    const { event, data } = req.body;
    if (event !== "transaction.updated") return;

    const transaction = data?.transaction;
    if (!transaction || transaction.status !== "APPROVED") return;

    const email = transaction.customer_email?.toLowerCase().trim();
    const reference = transaction.reference;
    const amount = transaction.amount_in_cents;
    const courseId = 2; // ID por defecto para Excel Básico

    if (!email) return;

    // Generar contraseña temporal
    const tempPassword = "SoluPro-" + Math.random().toString(36).slice(-6);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    console.log(`🛠️ Procesando acceso para: ${email}`);

    // 1. Insertar o actualizar usuario
    //    FIX #3: La columna password_hash ya existe gracias a fix-db.js
    await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash
         WHERE users.password_hash IS NULL`,
      [email, passwordHash]
    );

    // 2. Asignar curso al usuario
    await pool.query(
      `INSERT INTO user_courses (email, course_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [email, courseId]
    );

    // 3. Registrar transacción
    //    FIX #3: La columna reference ya existe gracias a fix-db.js
    await pool.query(
      `INSERT INTO transactions (email, reference, status, amount)
       VALUES ($1, $2, 'APPROVED', $3)
       ON CONFLICT DO NOTHING`,
      [email, reference, amount]
    );

    console.log(`✅ DB lista. Intentando enviar correo a ${email}...`);

    // 4. Enviar correo
    //    FIX #1: Remitente corregido — dominio raíz verificado, sin "send."
    resend.emails.send({
      from: 'Academia SoluPro <hola@academia-solupro.com>',
      to: email,
      subject: '🚀 ¡Bienvenido a la Academia SoluPro!',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #10b981;">¡Acceso Concedido!</h2>
          <p>Tu pago ha sido procesado con éxito. Ya puedes ver tus clases.</p>
          <hr>
          <p><strong>Credenciales de acceso:</strong></p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Contraseña:</strong> ${tempPassword}</p>
          <br>
          <a href="https://academia-solupro.com/login"
             style="background:#10b981; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">
            Entrar al Panel
          </a>
        </div>`
    }).catch(err => console.error(`❌ Error Correo:`, err.message));

  } catch (error) {
    console.error("❌ Error Webhook:", error.message);
  }
});

// ── AUTENTICACIÓN ─────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // FIX #3: Seleccionamos explícitamente password_hash (columna confirmada por fix-db.js)
    const result = await pool.query(
      `SELECT email, password_hash FROM users WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "No encontrado" });
    }

    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: "Clave errada" });

    const token = jwt.sign(
      { email: cleanEmail },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );
    res.json({ success: true, token });
  } catch (error) {
    console.error("❌ Error login:", error.message);
    res.status(500).json({ error: "Error interno" });
  }
});

app.post("/api/auto-login", (req, res) => {
  const token = jwt.sign(
    { email: req.body.email.toLowerCase().trim() },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "7d" }
  );
  res.json({ success: true, token });
});

// ── CURSOS Y LECCIONES (v7.11) ─────────────────────────────────────────────
app.get("/api/my-courses", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const { email } = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");

    const result = await pool.query(
      `SELECT c.id, c.title, c.description
       FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE LOWER(uc.email) = $1`,
      [email.toLowerCase().trim()]
    );
    res.json({ success: true, courses: result.rows });
  } catch (error) {
    console.error("❌ Error my-courses:", error.message);
    res.status(401).json({ error: "Sesión inválida" });
  }
});

app.get("/api/curriculum/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;

    // FIX #2: Alias correctos para que el Frontend reciba los nombres que espera:
    //   bunny_video_id  → video_url
    //   order_num       → order_index
    // FIX #2b: Filtramos por course_id (columna que sí existe en lessons)
    const result = await pool.query(
      `SELECT
         id,
         title,
         bunny_video_id  AS video_url,
         order_num       AS order_index
       FROM lessons
       WHERE course_id = $1
       ORDER BY order_num ASC`,
      [courseId]
    );
    res.json({ success: true, lessons: result.rows });
  } catch (error) {
    console.error("❌ Error curriculum:", error.message);
    res.status(500).json({ error: "Error al cargar contenido" });
  }
});

// ── INICIO DEL SERVIDOR ───────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 SoluPro v7.11 listo en puerto ${PORT}`));