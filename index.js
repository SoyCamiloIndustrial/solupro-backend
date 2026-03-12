// ======================================
// SOLUPRO BACKEND
// ======================================

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

// ======================================
// MIDDLEWARE
// ======================================

app.use(cors({
  origin: "*"
}));

app.use(express.json());

// ======================================
// DATABASE POSTGRES
// ======================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ======================================
// HEALTH CHECK
// ======================================

app.get("/", (req, res) => {
  res.send("SoluPro Backend running");
});

// ======================================
// LOGIN
// ======================================

app.post("/api/login", async (req, res) => {
  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email requerido"
      });
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

    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      error: "Error en login"
    });

  }
});

// ======================================
// AUTO LOGIN DESPUES DE WOMPI
// ======================================

app.post("/api/auto-login", async (req, res) => {

  console.log("AUTO LOGIN BODY:", req.body);

  try {

    const { transaction_id, email } = req.body;

    if (!transaction_id && !email) {
      return res.status(400).json({
        error: "transaction_id o email requerido"
      });
    }

    let userEmail = email;

    if (transaction_id) {

      const result = await pool.query(
        "SELECT email FROM transactions WHERE transaction_id = $1 LIMIT 1",
        [transaction_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Transaccion no encontrada"
        });
      }

      userEmail = result.rows[0].email;
    }

    const token = jwt.sign(
      { email: userEmail },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token
    });

  } catch (error) {

    console.error("AUTO LOGIN ERROR:", error);

    res.status(500).json({
      error: "Error interno auto login"
    });

  }

});

// ======================================
// MIS CURSOS
// ======================================

app.get("/api/my-courses", async (req, res) => {

  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Token requerido"
      });
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

    console.error("MY COURSES ERROR:", error);

    res.status(500).json({
      error: "Error obteniendo cursos"
    });

  }

});

// ======================================
// SERVER
// ======================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("SoluPro backend running on port " + PORT);
});