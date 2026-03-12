const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// ======================================
// CONEXIÓN A BASE DE DATOS (POSTGRES)
// ======================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ======================================
// HEALTH CHECK
// ======================================
app.get("/", (req, res) => {
  res.send("SoluPro backend funcionando 🚀 - Blindado contra mayúsculas");
});

// ======================================
// RUTAS DE ACCESO (LOGIN & AUTO-LOGIN)
// ======================================
app.post("/api/login", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  const token = jwt.sign(
    { email: email.toLowerCase() }, // Guardamos el email siempre en minúsculas
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "7d" }
  );
  res.json({ success: true, token });
});

app.post("/api/auto-login", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  const token = jwt.sign(
    { email: email.toLowerCase() }, // Guardamos el email siempre en minúsculas
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "7d" }
  );
  res.json({ success: true, token });
});

// ======================================
// OBTENER MIS CURSOS (DASHBOARD)
// ======================================
app.get("/api/my-courses", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token requerido" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    
    // Normalizamos el email del token a minúsculas
    const email = decoded.email.toLowerCase();

    const result = await pool.query(
      `SELECT c.id, c.title
       FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE LOWER(uc.email) = $1`, // Comparamos en minúsculas en la DB
      [email]
    );

    res.json({ courses: result.rows });
  } catch (error) {
    console.error("Error en my-courses:", error);
    res.status(500).json({ error: "Error obteniendo cursos" });
  }
});

// ======================================
// RUTA DE SETUP (PARA LIMPIAR Y ASIGNAR)
// ======================================
app.get("/api/setup-db", async (req, res) => {
  try {
    // 1. Asegurar tabla de cursos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT
      );
    `);

    // 2. Asegurar tabla de user_courses
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_courses (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        course_id INT
      );
    `);

    // 3. Crear el Bootcamp (ID 1)
    await pool.query(`
      INSERT INTO courses (id, title, description)
      VALUES (1, 'Bootcamp: Decisiones Inteligentes con Datos', 'Aprende a dominar los datos en tu negocio')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 4. Asignar el curso a tu correo (siempre en minúsculas)
    await pool.query(`
      INSERT INTO user_courses (email, course_id)
      VALUES ('cpenpen90@gmail.com', 1);
    `);

    res.send("<h1>✅ Base de datos sincronizada</h1><p>Correo asignado: cpenpen90@gmail.com</p>");
  } catch (error) {
    console.error("Error en setup-db:", error);
    res.status(500).send("Error: " + error.message);
  }
});

// ======================================
// INICIAR SERVIDOR
// ======================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Servidor SoluPro corriendo en puerto " + PORT);
});