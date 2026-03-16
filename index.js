require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Resend } = require('resend');

const app = express();
const port = process.env.PORT || 3001;

// ── CONFIGURACIÓN DE CORREOS ──────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// ── MIDDLEWARES ────────────────────────────────────────────────────────
// Restringimos para que solo tu frontend oficial pueda pedir datos
app.use(cors({
  origin: ['https://solupro-frontend.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// ── BASE DE DATOS ──────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── MIDDLEWARE DE AUTENTICACIÓN (Protege rutas privadas) ───────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: "Acceso denegado. No hay token." });

  jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_seguro_solupro', (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido o expirado." });
    req.user = user;
    next();
  });
};

// ============================================================================
// ── ENDPOINTS DE LA APLICACIÓN ──────────────────────────────────────────────
// ============================================================================

// 1. GET CURRICULUM (Para el panel de clases)
app.get('/api/curriculum/:courseId', async (req, res) => {
  try {
    // Para este MVP, traemos todas las lecciones ordenadas por ID 
    // sin buscar el course_id ya que la tabla no lo tiene.
    const result = await pool.query(
      'SELECT id, title, bunny_video_id as video_url, order_num FROM lessons ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo el currículum' });
  }
});

// 2. GET MY COURSES (Para el Dashboard)
app.get('/api/my-courses', authenticateToken, async (req, res) => {
  try {
    const email = req.user.email;
    const result = await pool.query(
      `SELECT c.id, c.title, c.description 
       FROM courses c 
       JOIN user_courses uc ON c.id = uc.course_id 
       WHERE uc.email = $1`,
      [email]
    );
    res.json({ courses: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo tus cursos' });
  }
});

//