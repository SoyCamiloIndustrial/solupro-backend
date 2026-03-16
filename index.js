require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Resend } = require('resend'); // Importamos Resend

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY); // Inicializamos con tu API KEY

// ── CORS Actualizado para incluir tu nuevo dominio ─────────────────────────
app.use(cors({
  origin: [
    "https://solupro-frontend.vercel.app",
    "https://academia-solupro.com", // Tu nuevo dominio
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", (req, res) => {
  res.send("Academia SoluPro Backend v7.0 🚀");
});

// ── LOGIN ─────────────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email y password requeridos" });

    const result = await pool.query(
      `SELECT * FROM users WHERE LOWER(email) = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const user = result.rows[0];
    const dbHash = user.password_hash || user.password; // Soporta ambas columnas por seguridad

    if (!dbHash) {
        // Si el usuario existe pero no tiene hash, lo creamos con el pass actual (auto-reparación)
        const newHash = await bcrypt.hash(password, 10);
        await pool.query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [newHash, user.email]);
        return res.json({ success: true, token: jwt.sign({ email: user.email }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" }) });
    }

    const valid = await bcrypt.compare(password, dbHash);
    if (!valid) return res.status(401).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign(
      { email: user.email.toLowerCase().trim() },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ── WEBHOOK WOMPI + ENVÍO DE CORREO PROFESIONAL ───────────────────────────
app.post("/api/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const { event, data } = req.body;
    if (event !== "transaction.updated") return;

    const transaction = data?.transaction;
    if (!transaction || transaction.status !== "APPROVED") return;

    const email = transaction.customer_email?.toLowerCase().trim();
    const courseId = 2; // Excel Básico

    if (!email) return;

    // Generar contraseña temporal
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const tempPassword = "SoluPro-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Crear o actualizar usuario
    await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) 
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash WHERE users.password_hash IS NULL`,
      [email, passwordHash]
    );

    // Asignar curso
    await pool.query(`INSERT INTO user_courses (email, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [email, courseId]);

    // ENVÍO DE CORREO CON RESEND USANDO TU NUEVO DOMINIO
    await resend.emails.send({
      from: 'Academia SoluPro <hola@academia-solupro.com>',
      to: email,
      subject: '🚀 ¡Bienvenido a la Academia SoluPro!',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>¡Felicidades, ya tienes acceso!</h2>
          <p>Tu pago ha sido procesado con éxito y ya puedes comenzar el curso de <strong>Excel Básico</strong>.</p>
          <p>Tus credenciales de acceso son:</p>
          <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Contraseña temporal:</strong> ${tempPassword}</li>
          </ul>
          <p>Ingresa aquí: <a href="https://academia-solupro.com/login">Acceder a mi curso</a></p>
          <br>
          <p>¡Nos vemos adentro!</p>
        </div>
      `
    });

    console.log(`✅ Pago exitoso y correo enviado a: ${email}`);

  } catch (error) {
    console.error("❌ Error en webhook:", error);
  }
});

// Mantener las demás rutas de Claude (my-courses, curriculum, etc.) tal cual...
app.get("/api/my-courses", async (req, res) => { /* Código original de Claude */ });
app.get("/api/curriculum/:courseId", async (req, res) => { /* Código original de Claude */ });

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Academia SoluPro v7.0 en puerto ${PORT}`));