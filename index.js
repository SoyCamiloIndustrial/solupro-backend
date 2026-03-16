require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// ── CORS: Permite tu nuevo dominio y el de Vercel ──────────────────────────
app.use(cors({
  origin: [
    "https://solupro-frontend.vercel.app",
    "https://academia-solupro.com",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ── Conexión a Base de Datos ──────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── Health Check ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("Academia SoluPro API v7.3 🚀");
});

// ── LOGIN ESTÁNDAR ────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Faltan datos" });

    const result = await pool.query(
      `SELECT * FROM users WHERE LOWER(email) = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign(
      { email: user.email.toLowerCase().trim() },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    res.json({ success: true, token });
  } catch (error) {
    console.error("Error login:", error);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── AUTO-LOGIN (Post-pago) ────────────────────────────────────────────────
app.post("/api/auto-login", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  const token = jwt.sign(
    { email: email.toLowerCase().trim() },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "7d" }
  );
  res.json({ success: true, token });
});

// ── WEBHOOK WOMPI: Lógica "Resistente a Balas" ────────────────────────────
app.post("/api/webhook", async (req, res) => {
  // 1. Responder a Wompi de inmediato para evitar bloqueos
  res.sendStatus(200);

  try {
    const { event, data } = req.body;
    if (event !== "transaction.updated") return;

    const transaction = data?.transaction;
    if (!transaction || transaction.status !== "APPROVED") return;

    const email = transaction.customer_email?.toLowerCase().trim();
    const reference = transaction.reference;
    const amount = transaction.amount_in_cents;
    const courseId = 2; // ID del curso de Excel

    if (!email) return;

    // Generar credenciales
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const tempPassword = "SoluPro-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    console.log(`⏳ Procesando acceso para: ${email}...`);

    // 2. Operaciones de Base de Datos (Síncronas y prioritarias)
    // Crear/Actualizar Usuario
    await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) 
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash WHERE users.password_hash IS NULL`,
      [email, passwordHash]
    );

    // Asignar Curso
    await pool.query(
      `INSERT INTO user_courses (email, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [email, courseId]
    );

    // Registrar Transacción (Usando la columna 'reference' que arreglamos)
    await pool.query(
      `INSERT INTO transactions (email, reference, status, amount, created_at)
       VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING`,
      [email, reference, transaction.status, amount]
    );

    console.log(`✅ Acceso concedido en DB para ${email}`);

    // 3. Enviar Correo en segundo plano (No bloquea el flujo principal)
    resend.emails.send({
      from: 'Academia SoluPro <hola@send.academia-solupro.com>',
      to: email,
      subject: '🚀 ¡Bienvenido a la Academia SoluPro!',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #10b981;">¡Felicidades, ya tienes acceso!</h2>
          <p>Tu pago ha sido procesado con éxito. Ya puedes comenzar el curso de <strong>Excel Básico</strong>.</p>
          <hr>
          <p><strong>Tus credenciales de acceso:</strong></p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Contraseña temporal:</strong> ${tempPassword}</p>
          <br>
          <a href="https://academia-solupro.com/login" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Entrar a la Academia</a>
        </div>
      `
    }).then(() => {
      console.log(`📧 Correo de bienvenida enviado a ${email}`);
    }).catch(err => {
      console.error(`❌ Error al enviar correo a ${email}:`, err.message);
    });

  } catch (error) {
    console.error("❌ Error crítico en el Webhook:", error);
  }
});

// ── MIS CURSOS ────────────────────────────────────────────────────────────
app.get("/api/my-courses", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No autorizado" });

    const token = authHeader.split(" ")[1];
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
  } catch (error) {
    res.status(401).json({ error: "Token inválido" });
  }
});

// ── CURRICULUM ────────────────────────────────────────────────────────────
app.get("/api/curriculum/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Obtener lecciones directamente (ajustado a order_num)
    const result = await pool.query(
      `SELECT id, title, bunny_video_id, order_num 
       FROM lessons WHERE course_id = $1 ORDER BY order_num ASC`,
      [courseId]
    );

    res.json({ success: true, lessons: result.rows });
  } catch (error) {
    console.error("Error curriculum:", error);
    res.status(500).json({ error: "Error al cargar lecciones" });
  }
});

// ── Servidor ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor SoluPro v7.3 listo en puerto ${PORT}`);
});