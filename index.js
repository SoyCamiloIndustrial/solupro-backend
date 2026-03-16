require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
app.use(express.json());
app.use(cors());

// Configuración de Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuración de PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. WEBHOOK DE WOMPI (Para crear el usuario tras el pago)
app.post('/webhook-wompi', async (req, res) => {
  const { data } = req.body;
  
  if (data && data.transaction && data.transaction.status === 'APPROVED') {
    const email = data.transaction.customer_email;
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    try {
      // Insertar o actualizar usuario
      await pool.query(
        'INSERT INTO users (email, password) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password = $2',
        [email, hashedPassword]
      );

      // Enviar correo con Resend
      await resend.emails.send({
        from: 'SoluPro <onboarding@resend.dev>',
        to: email,
        subject: '¡Bienvenido a SoluPro - Tu curso de Excel!',
        html: `
          <h1>¡Pago Exitoso! 🥩🔥</h1>
          <p>Ya puedes acceder a tu plataforma de Excel.</p>
          <p><strong>Tu usuario:</strong> ${email}</p>
          <p><strong>Tu contraseña temporal:</strong> ${tempPassword}</p>
          <p><a href="https://solupro-frontend.vercel.app/login">Acceder aquí</a></p>
        `
      });

      console.log(`Usuario creado y correo enviado a: ${email}`);
      res.status(200).send('OK');
    } catch (err) {
      console.error('Error en Webhook:', err);
      res.status(500).send('Error interno');
    }
  } else {
    res.status(200).send('Transacción no aprobada o data inválida');
  }
});

// 2. POST LOGIN (Aquí está el cambio para ver el error real)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token });
    } else {
      return res.status(401).json({ error: "Credenciales inválidas o usuario no existe." });
    }
  } catch (err) {
    console.error("Error capturado:", err);
    // REVELACIÓN: Esto mostrará el error real en el texto rojo de tu web
    res.status(500).json({ error: "🔥 ERROR REAL: " + err.message });
  }
});

// 3. OBTENER LECCIONES
app.get('/lessons', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title, bunny_video_id as video_url, order_num FROM lessons ORDER BY order_num ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al cargar lecciones: " + err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en el puerto ${PORT}`);
});