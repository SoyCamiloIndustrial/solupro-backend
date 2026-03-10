require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

/* ======================================
   DEBUG VARIABLES
====================================== */

console.log("🔎 WOMPI_PUBLIC_KEY:", process.env.WOMPI_PUBLIC_KEY ? "OK" : "NO DEFINIDA");
console.log("🔎 WOMPI_INTEGRITY_KEY:", process.env.WOMPI_INTEGRITY_KEY ? "OK" : "NO DEFINIDA");
console.log("🔎 JWT_SECRET:", process.env.JWT_SECRET ? "OK" : "NO DEFINIDA");

/* ======================================
   JWT MIDDLEWARE
====================================== */

function verifyToken(req, res, next) {

  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

    if (err) {
      return res.status(403).json({ error: "Token inválido" });
    }

    req.user = decoded;

    next();
  });
}

/* ======================================
   ROOT
====================================== */

app.get("/", (req, res) => {
  res.json({ status: "Backend SoluPro funcionando 🚀" });
});

/* ======================================
   LOGIN
====================================== */

app.post("/api/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: "Password incorrecta" });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {

    console.error("ERROR LOGIN:", error);

    res.status(500).json({
      error: "Error en login"
    });

  }

});

/* ======================================
   MIS CURSOS
====================================== */

app.get("/api/my-courses", verifyToken, async (req, res) => {

  try {

    const email = req.user.email;

    console.log("EMAIL TOKEN:", email);

    const result = await pool.query(
      "SELECT * FROM enrollments WHERE email = $1",
      [email]
    );

    res.json({
      success: true,
      courses: result.rows
    });

  } catch (error) {

    console.error("ERROR /api/my-courses:", error);

    res.status(500).json({
      error: "Error obteniendo cursos"
    });

  }

});

/* ======================================
   WOMPI PUBLIC KEY
====================================== */

app.get("/api/public-key", (req, res) => {

  if (!process.env.WOMPI_PUBLIC_KEY) {
    return res.status(500).json({
      error: "WOMPI_PUBLIC_KEY no configurada"
    });
  }

  res.json({
    publicKey: process.env.WOMPI_PUBLIC_KEY
  });

});

/* ======================================
   WOMPI SIGNATURE
====================================== */

app.get("/api/signature", (req, res) => {

  try {

    const reference = "ref_" + Date.now();
    const amount = "200000";
    const currency = "COP";

    const integrityKey = process.env.WOMPI_INTEGRITY_KEY;

    const stringToSign = reference + amount + currency + integrityKey;

    const signature = crypto
      .createHash("sha256")
      .update(stringToSign)
      .digest("hex");

    res.json({
      reference,
      amount,
      currency,
      signature
    });

  } catch (err) {

    console.error("ERROR SIGNATURE:", err);

    res.status(500).json({
      error: "Error generando firma"
    });

  }

});

/* ======================================
   SERVER
====================================== */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});