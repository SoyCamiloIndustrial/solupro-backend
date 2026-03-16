require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// ── 1. MIDDLEWARES Y CABECERAS DE ENCODING ────────────────────────────────
app.use(cors({
  origin: ["https://academia-solupro.com", "https://solupro-frontend.vercel.app", "http://localhost:3000"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Forzar UTF-8 en todas las respuestas de la API para evitar caracteres raros
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// ── 2. CONEXIÓN A BASE DE DATOS CON UTF-8 ────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Forzamos al cliente de Postgres a hablar en UTF8
  options: "-c client_encoding=UTF8"
});

// ── 3. RUTAS PRINCIPALES ──────────────────────────────────────────────────
app.get("/", (req, res) => res.send("🚀 Academia SoluPro API v7.12 Online (UTF-8 Ready)"));

// WEBHOOK WOMPI: PROCESAMIENTO DE PAGOS Y CREACIÓN DE USUARIOS
app.post("/api/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const { event, data } = req.body;
    if (event !== "transaction.updated" || data.transaction.status !== "APPROVED") return;

    const { customer_email: email, reference, amount_in_cents: amount } = data.transaction;
    const cleanEmail = email.toLowerCase().trim();
    const courseId = 2; // ID de Excel Básico

    const tempPass = "SoluPro-" + Math.random().toString(36).slice(-6);
    const hash = await bcrypt.hash(tempPass, 10);

    console.log(`🛠️ Procesando acceso para: ${cleanEmail}`);

    // Insertar/Actualizar Usuario
    await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) 
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash WHERE users.password_hash IS NULL`,
      [cleanEmail, hash]
    );

    // Asignar Curso
    await pool.query(`INSERT INTO user_courses (email, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [cleanEmail, courseId]);

    // Registrar Transacción
    await pool.query(
      `INSERT INTO transactions (email, reference, status, amount) 
       VALUES ($1, $2, 'APPROVED', $3) ON CONFLICT (reference) DO NOTHING`,
      [cleanEmail, reference, amount]
    );

    // Enviar Correo de Bienvenida (Remitente sin subdominio "send.")
    await resend.emails.send({
      from: 'Academia SoluPro <hola@academia-solupro.com>',
      to: cleanEmail,
      subject: '🚀 ¡Bienvenido a la Academia SoluPro!',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>¡Ya tienes acceso!</h2>
          <p>Usa estas credenciales para entrar al panel:</p>
          <p><strong>Email:</strong> ${cleanEmail}</p>
          <p><strong>Contraseña Temporal:</strong> ${tempPass}</p>
          <br>
          <a href="https://academia-solupro.com/login">Entrar a la Academia</a>
        </div>`
    });

    console.log(`✅ Registro y correo completados para: ${cleanEmail}`);
  } catch (err) {
    console.error("❌ Error Webhook:", err.message);
  }
});

// LOGIN: AUTENTICACIÓN POR BCRYPT
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    
    const result = await pool.query(`SELECT * FROM users WHERE LOWER(email) = $1`, [cleanEmail]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) return res.status(401).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ email: cleanEmail }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
    res.json({ success: true, token });
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

app.post("/api/auto-login", (req, res) => {
  const { email } = req.body;
  const token = jwt.sign({ email: email.toLowerCase().trim() }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
  res.json({ success: true, token });
});

// CURSOS: LISTADO DE CURSOS DEL USUARIO
app.get("/api/my-courses", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    const email = decoded.email.toLowerCase().trim();

    const result = await pool.query(
      `SELECT c.id, c.title, c.description
       FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE LOWER(uc.email) = $1`,
      [email]
    );
    res.json({ success: true, courses: result.rows });
  } catch (e) {
    res.status(401).json({ error: "Sesión inválida" });
  }
});

// CURRICULUM: LAS 17 LECCIONES CON ALIAS PARA FRONTEND (SIN DAÑAR NADA)
app.get("/api/curriculum/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
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
  } catch (err) {
    res.status(500).json({ error: "Error al cargar lecciones" });
  }
});

// ── 4. LANZAMIENTO ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor SoluPro v7.12 (UTF-8 Ready) listo en puerto ${PORT}`);
});