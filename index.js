const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());


// ===============================
// HEALTH CHECK
// ===============================

app.get("/", (req, res) => {
  res.send("SoluPro backend funcionando 🚀");
});


// ===============================
// AUTO LOGIN
// ===============================

app.post("/api/auto-login", (req, res) => {

  try {

    console.log("BODY RECIBIDO:", req.body);

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email requerido"
      });
    }

    const token = jwt.sign(
      { email },
      "dev_secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token
    });

  } catch (error) {

    console.error("ERROR AUTO LOGIN:", error);

    res.status(500).json({
      error: "Error interno auto login"
    });

  }

});


// ===============================
// SERVER
// ===============================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("Servidor SoluPro corriendo en puerto " + PORT);
});
