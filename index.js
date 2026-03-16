require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// FUNCIÓN DE AUTO-CONFIGURACIÓN
const inicializarTodo = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL);
    CREATE TABLE IF NOT EXISTS lessons (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, bunny_video_id VARCHAR(255) NOT NULL, order_num INTEGER NOT NULL);
  `);
  
  // Usuario maestro para tu prueba de hoy
  const hash = await bcrypt.hash('123456', 10);
  await pool.query("INSERT INTO users (email, password) VALUES ('soluprosoluciones@gmail.com', $1) ON CONFLICT (email) DO NOTHING", [hash]);

  // Insertar al menos una lección para que no se vea vacío
  const res = await pool.query('SELECT COUNT(*) FROM lessons');
  if (parseInt(res.rows[0].count) === 0) {
    await pool.query("INSERT INTO lessons (title, bunny_video_id, order_num) VALUES ('1. Bienvenida al curso', '8c377317-910e-4346-bc50-89196c818063', 1)");
  }
};

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    await inicializarTodo();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '24h' });
      return res.json({ token });
    }
    return res.status(401).json({ error: "Credenciales inválidas" });
  } catch (err) {
    res.status(500).json({ error: "Error de conexión: " + err.message });
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
app.listen(PORT, () => console.log(`🚀 Corriendo en puerto ${PORT}`));