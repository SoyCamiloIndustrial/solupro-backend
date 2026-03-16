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

const resend = new Resend(process.env.RESEND_API_KEY);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// FUNCIÓN PARA RECONSTRUIR TODO SI NO EXISTE
const inicializarTablas = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS lessons (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      bunny_video_id VARCHAR(255) NOT NULL,
      order_num INTEGER NOT NULL
    );
  `);
  
  // Crear tu usuario de prueba automáticamente
  const hashedPass = await bcrypt.hash('123456', 10);
  await pool.query(`
    INSERT INTO users (email, password) 
    VALUES ('soluprosoluciones@gmail.com', $1) 
    ON CONFLICT (email) DO NOTHING`, [hashedPass]);
};

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    await inicializarTablas(); // Esto repara la base de datos en cada intento si falta algo
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token });
    }
    return res.status(401).json({ error: "Credenciales inválidas." });
  } catch (err) {
    res.status(500).json({ error: "Falla crítica: " + err.message });
  }
});

app.get('/lessons', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lessons ORDER BY order_num ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));