const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

/* conexión a postgres */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ruta base */

app.get("/", (req, res) => {
  res.send("SoluPro backend funcionando");
});

/* LOGIN */

app.post("/api/login", async (req, res) => {

  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email requerido" });
    }

    const token = jwt.sign(
      { email },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error en login"
    });

  }

});

/* AUTO LOGIN */

app.post("/api/auto-login", async (req, res) => {

  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email requerido" });
    }

    const token = jwt.sign(
      { email },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error en auto login"
    });

  }

});

/* OBTENER CURSOS */

app.get("/api/my-courses", async (req, res) => {

  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token requerido" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev_secret"
    );

    const email = decoded.email;

    const result = await pool.query(
      `
      SELECT c.id, c.title
      FROM user_courses uc
      JOIN courses c ON c.id = uc.course_id
      WHERE uc.email = $1
      `,
      [email]
    );

    res.json({
      courses: result.rows
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error obteniendo cursos"
    });

  }

});

/* servidor */

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("Servidor SoluPro corriendo en puerto " + PORT);
});
