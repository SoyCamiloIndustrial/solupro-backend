const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", (req, res) => {
  res.send("SoluPro Backend: ¡Conexión con user_courses establecida! 🚀");
});

// LOGIN / AUTO-LOGIN
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

// EL ENDPOINT CRÍTICO (El fix de Claude + Seguridad JWT)
app.get("/api/my-courses", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token requerido" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    const email = decoded.email.toLowerCase().trim();

    // AQUÍ ESTÁ EL CAMBIO: Buscamos en user_courses, NO en enrollments
    const result = await pool.query(
      `SELECT c.id, c.title, c.description
       FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE LOWER(uc.email) = $1`,
      [email]
    );

    res.json({ 
      success: true, 
      courses: result.rows 
    });
  } catch (error) {
    console.error("Error en my-courses:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ENDPOINT DE DIAGNÓSTICO (Para que siempre puedas revisar)
app.get("/api/check-db/:email", async (req, res) => {
  try {
    const userAccess = await pool.query(
      "SELECT * FROM user_courses WHERE LOWER(email) = LOWER($1)", 
      [req.params.email]
    );
    res.json({ email_buscado: req.params.email, acceso: userAccess.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));