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

// Función para asegurar que las tablas existan con el nombre correcto
const inicializarDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL);
    CREATE TABLE IF NOT EXISTS lessons (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, bunny_video_id VARCHAR(255) NOT NULL, order_num INTEGER NOT NULL);
  `);
};

app.get('/', (req, res) => res.send('SoluPro Backend Vivo ✅'));

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    await inicializarDB();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    // Usamos .password (nombre correcto en tu BD)
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '24h' });
      return res.json({ token });
    }
    return res.status(401).json({ error: "Credenciales inválidas" });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

app.post('/webhook-wompi', async (req, res) => {
    const { data } = req.body;
    if (data?.transaction?.status === 'APPROVED') {
        const email = data.transaction.customer_email;
        const tempPass = Math.random().toString(36).slice(-8);
        const hash = await bcrypt.hash(tempPass, 10);
        try {
            await inicializarDB();
            // CORRECCIÓN: Usamos 'password' para que coincida con tu BD
            await pool.query(
                'INSERT INTO users (email, password) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password = $2',
                [email, hash]
            );
            await resend.emails.send({
                from: 'SoluPro <onboarding@resend.dev>',
                to: email,
                subject: 'Acceso a SoluPro Excel',
                html: `<p>Bienvenido. Tu contraseña es: <strong>${tempPass}</strong></p>`
            });
            res.status(200).send('OK');
        } catch (e) { res.status(500).send('Error'); }
    } else { res.status(200).send('No aprobado'); }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 SoluPro Backend v4.0 en puerto ${PORT}`));