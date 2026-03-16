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

// ESTO REPARA TODO SOLITO
const inicializarTodo = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL);
      CREATE TABLE IF NOT EXISTS lessons (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, bunny_video_id VARCHAR(255) NOT NULL, order_num INTEGER NOT NULL);
    `);
    
    // Crear tu usuario de emergencia: soluprosoluciones@gmail.com / clave: 123456
    const hash = await bcrypt.hash('123456', 10);
    await pool.query("INSERT INTO users (email, password) VALUES ('soluprosoluciones@gmail.com', $1) ON CONFLICT (email) DO NOTHING", [hash]);
    
    // Insertar lecciones de prueba si no hay
    const count = await pool.query('SELECT COUNT(*) FROM lessons');
    if (parseInt(count.rows[0].count) === 0) {
      await pool.query("INSERT INTO lessons (title, bunny_video_id, order_num) VALUES ('Bienvenidos', '8c377317-910e-4346-bc50-89196c818063', 1)");
    }
  } catch (e) { console.error("Error inicializando:", e); }
};

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    await inicializarTodo();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
      return res.json({ token });
    }
    return res.status(401).json({ error: "Credenciales inválidas" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/lessons', async (req, res) => {
  try {
    await inicializarTodo();
    const result = await pool.query('SELECT * FROM lessons ORDER BY order_num ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));