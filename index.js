const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// ======================================
// CONEXIÓN A BASE DE DATOS
// ======================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ======================================
// RUTAS BÁSICAS
// ======================================
app.get("/", (req, res) => {
  res.send("SoluPro backend funcionando 🚀 - Modo Diagnóstico Activo");
});

// LOGIN / AUTO-LOGIN (Normalizando a minúsculas)
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

// ======================================
// OBTENER CURSOS (CON FILTRO DE SEGURIDAD)
// ======================================
app.get("/api/my-courses", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token requerido" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    const email = decoded.email.toLowerCase().trim();

    // Query optimizada: Busca por email y trae la info del curso
    const result = await pool.query(
      `SELECT c.id, c.title, c.description
       FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE LOWER(uc.email) = $1`,
      [email]
    );

    res.json({ courses: result.rows });
  } catch (error) {
    console.error("Error en my-courses:", error);
    res.status(500).json({ error: "Error obteniendo cursos" });
  }
});

// ======================================
// 🔍 ENDPOINT DE DIAGNÓSTICO (OPCIÓN C)
// ======================================
app.get("/api/check-db/:email", async (req, res) => {
  const emailABuscar = req.params.email.toLowerCase().trim();
  try {
    const courses = await pool.query("SELECT * FROM courses");
    const userAccess = await pool.query(
      "SELECT * FROM user_courses WHERE LOWER(email) = $1", 
      [emailABuscar]
    );
    const allUserCourses = await pool.query("SELECT * FROM user_courses");

    res.json({
      status: "Diagnóstico Ejecutado",
      buscando_email: emailABuscar,
      tabla_courses: courses.rows,
      tu_acceso_especifico: userAccess.rows,
      toda_la_tabla_user_courses: allUserCourses.rows,
      nota: "Si 'tu_acceso_especifico' está vacío pero 'toda_la_tabla' tiene datos, hay un error de tipeo en el email."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================
// INICIAR SERVIDOR
// ======================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});