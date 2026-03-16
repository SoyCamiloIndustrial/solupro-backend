require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

// ── CORS estricto ─────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "https://solupro-frontend.vercel.app",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ── Base de datos ─────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── Health check ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("SoluPro Backend v3.0 🚀");
});

// ── LOGIN ─────────────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email y password requeridos" });

    const result = await pool.query(
      `SELECT * FROM users WHERE LOWER(email) = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ error: "Usuario no encontrado" });

    const user = result.rows[0];

    if (!user.password_hash) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users SET password_hash = $1 WHERE email = $2`,
        [passwordHash, user.email]
      );
    } else {
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid)
        return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.sign(
      { email: user.email.toLowerCase().trim() },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    res.json({ success: true, token });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ── AUTO-LOGIN (post-pago) ────────────────────────────────────────────────
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

// ── MIS CURSOS ────────────────────────────────────────────────────────────
app.get("/api/my-courses", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token requerido" });

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
    console.error("Error en my-courses:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ── CURRICULUM (módulos + lecciones por curso) ────────────────────────────
app.get("/api/curriculum/:courseId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token requerido" });

    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET || "dev_secret");

    const { courseId } = req.params;

    const modulesResult = await pool.query(
      `SELECT id, title, order_num FROM modules
       WHERE course_id = $1 ORDER BY order_num`,
      [courseId]
    );

    const modules = await Promise.all(
      modulesResult.rows.map(async (mod) => {
        const lessonsResult = await pool.query(
          `SELECT id, title, bunny_video_id, order_num FROM lessons
           WHERE module_id = $1 ORDER BY order_num`,
          [mod.id]
        );
        return { ...mod, lessons: lessonsResult.rows };
      })
    );

    res.json({ success: true, modules });
  } catch (error) {
    console.error("Error en curriculum:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ── WEBHOOK WOMPI ─────────────────────────────────────────────────────────
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
    const tempPassword = "SoluPro-" + Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Crear usuario si no existe
    const userCheck = await pool.query(
      `SELECT id, password_hash FROM users WHERE email = $1`, [email]
    );

    if (userCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2)`,
        [email, passwordHash]
      );
    } else if (!userCheck.rows[0].password_hash) {
      await pool.query(
        `UPDATE users SET password_hash = $1 WHERE email = $2`,
        [passwordHash, email]
      );
    }

    // Asignar curso
    await pool.query(
      `INSERT INTO user_courses (email, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [email, courseId]
    );

    // Log transacción
    await pool.query(
      `INSERT INTO transactions (email, reference, status, amount, created_at)
       VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING`,
      [email, transaction.reference, transaction.status, transaction.amount_in_cents]
    );

    console.log(`✅ Webhook: ${email} → curso ${courseId} | pass: ${tempPassword}`);

  } catch (error) {
    console.error("❌ Error en webhook:", error);
  }
});

// ── DIAGNÓSTICO ───────────────────────────────────────────────────────────
app.get("/api/check-db/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM user_courses WHERE LOWER(email) = LOWER($1)",
      [req.params.email]
    );
    res.json({ email: req.params.email, acceso: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Servidor ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`SoluPro Backend v3.0 en puerto ${PORT}`));