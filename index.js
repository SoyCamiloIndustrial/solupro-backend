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
  res.send("SoluPro backend funcionando 🚀");
});

// ======================================
// RUTAS DE ACCESO (LOGIN & AUTO-LOGIN)
// ======================================
app.post("/api/login", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  const token = jwt.sign(
    { email },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "7d" }
  );
  res.json({ success: true, token });
});

app.post("/api/auto-login", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  const token = jwt.sign(
    { email },
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
    const email = decoded.email;

    const result = await pool.query(
      `SELECT c.id, c.title
       FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE uc.email = $1`,
      [email]
    );

    res.json({ courses: result.rows });
  } catch (error) {
    console.error("Error en my-courses:", error);
    res.status(500).json({ error: "Error obteniendo cursos" });
  }
});

// ======================================
// RUTA SECRETA DE SETUP (LA PUERTA TRASERA)
// ======================================
app.get("/api/setup-db", async (req, res) => {
  try {
    // 1. Crear tabla de cursos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT
      );
    `);

    // 2. Crear tabla de usuarios_cursos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_courses (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        course_id INT
      );
    `);

    // 3. Crear el Bootcamp (forzamos el ID 1)
    await pool.query(`
      INSERT INTO courses (id, title, description)
      VALUES (1, 'Bootcamp: Decisiones Inteligentes con Datos', 'Aprende a dominar los datos en tu negocio')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 4. Asignarte el curso a tu correo real
    await pool.query(`
      INSERT INTO user_courses (email, course_id)
      VALUES ('cpenpen90@gmail.com', 1);
    `);

    res.send("<h1>✅ ¡Bóveda construida y curso asignado a cpenpen90@gmail.com!</h1><p>Ya puedes ir a tu localhost:3000/dashboard y recargar la página.</p>");
  } catch (error) {
    console.error("Error en setup-db:", error);
    res.status(500).send("Hubo un error: " + error.message);
  }
});

// ======================================
// INICIAR SERVIDOR
// ======================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Servidor SoluPro corriendo en puerto " + PORT);
});
