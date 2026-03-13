const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

// ── CORS estricto ─────────────────────────────────────────────────────────
const corsOptions = {
  origin: [
    "https://solupro-frontend.vercel.app", // producción
    "http://localhost:3000"                 // desarrollo local
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json());

// ── Base de datos ─────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── Health check ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("SoluPro Backend v1.0 — Producción 🚀");
});

// ── LOGIN ─────────────────────────────────────────────────────────────────
app.post("/api/login", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  const token = jwt.sign(
    { email: email.toLowerCase().trim() },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "7d" }
  );
  res.json({ success: true, token });
});

// ── AUTO-LOGIN (llamado por /success después del pago) ────────────────────
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

// ── MIS CURSOS (lee email del JWT) ────────────────────────────────────────
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

// ── DIAGNÓSTICO ───────────────────────────────────────────────────────────
app.get("/api/check-db/:email", async (req, res) => {
  try {
    const userAccess = await pool.query(
      "SELECT * FROM user_courses WHERE LOWER(email) = LOWER($1)",
      [req.params.email]
    );
    res.json({ email_buscado: req.params.email, acceso: userAccess.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Servidor ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));