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
    const { courseId } = req.params;
    const result = await pool.query(
      'SELECT id, title, bunny_video_id as video_url, order_index FROM lessons WHERE course_id = $1 ORDER BY order_index ASC',
      [courseId]
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

// 3. POST LOGIN MANUAL
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: "El correo es requerido." });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas o usuario no existe." });
    }

    const user = result.rows[0];

    // Si el usuario tiene contraseña, la verificamos
    if (user.password_hash && password) {
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: "Credenciales inválidas." });
      }
    } else if (!user.password_hash) {
       // Si no tiene contraseña (caso extremo), lo rechazamos y pedimos que recupere clave
       return res.status(401).json({ error: "Por favor, usa la opción 'Olvidé mi contraseña' para crear una clave de acceso." });
    }

    // Generar Token
    const token = jwt.sign(
      { email: user.email }, 
      process.env.JWT_SECRET || 'secreto_super_seguro_solupro', 
      { expiresIn: '7d' }
    );
    
    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el servidor al iniciar sesión." });
  }
});

// 4. POST AUTO-LOGIN (Usado inmediatamente después de pagar)
app.post('/api/auto-login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "El correo es requerido." });

    // Verificamos si realmente existe y tiene cursos para evitar abusos
    const result = await pool.query('SELECT * FROM user_courses WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "No se encontraron compras para este correo." });
    }

    const token = jwt.sign(
      { email }, 
      process.env.JWT_SECRET || 'secreto_super_seguro_solupro', 
      { expiresIn: '7d' }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el auto-login." });
  }
});

// ============================================================================
// ── WEBHOOK DE WOMPI (CEREBRO DE VENTAS Y ACCESOS) ──────────────────────────
// ============================================================================
app.post("/api/webhook", async (req, res) => {
  // 1. Responder 200 inmediatamente a Wompi para que no reintente
  res.sendStatus(200);

  try {
    const { event, data } = req.body;

    // Solo procesamos transacciones aprobadas
    if (event !== "transaction.updated") return;
    const transaction = data?.transaction;
    if (!transaction || transaction.status !== "APPROVED") return;

    const email = transaction.customer_email?.toLowerCase().trim();
    // En el MVP el curso siempre es 2 (Excel)
    const courseId = 2; 

    if (!email) return;

    // ── 1. Generar contraseña temporal segura ─────────────────────────
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const tempPassword = "SoluPro-" + Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");

    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // ── 2. Crear usuario o actualizar si no tiene contraseña ──────────
    const userCheck = await pool.query(
      `SELECT id, password_hash FROM users WHERE email = $1`,
      [email]
    );

    if (userCheck.rows.length === 0) {
      // Usuario nuevo
      await pool.query(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2)`,
        [email, passwordHash]
      );
      console.log(`✅ Usuario creado: ${email}`);
    } else if (!userCheck.rows[0].password_hash) {
      // Usuario existe pero venía con NULL (Compras antiguas)
      await pool.query(
        `UPDATE users SET password_hash = $1 WHERE email = $2`,
        [passwordHash, email]
      );
      console.log(`✅ Contraseña asignada a usuario antiguo: ${email}`);
    }

    // ── 3. Asignar el curso ───────────────────────────────────────────
    await pool.query(
      `INSERT INTO user_courses (email, course_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [email, courseId]
    );

    // ── 4. Guardar Log de la transacción ──────────────────────────────
    await pool.query(
      `INSERT INTO transactions (email, reference, status, amount, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [email, transaction.reference, transaction.status, transaction.amount_in_cents]
    );

    // ── 5. Email de bienvenida con Resend ─────────────────────────────
    try {
      // Importante: Solo enviamos correo si se generó la contraseña ahorita
      // Si el usuario ya tenía contraseña de antes, no se la sobreescribimos.
      if (userCheck.rows.length === 0 || !userCheck.rows[0].password_hash) {
        await resend.emails.send({
          from: "SoluPro <onboarding@resend.dev>", // Cambia esto cuando tengas dominio oficial
          to: email,
          subject: "🥩 ¡Bienvenido a Excel Básico! Aquí están tus accesos",
          html: `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            
            <tr>
              <td style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:32px;text-align:center;">
                <span style="color:white;font-weight:900;font-size:18px;">SOLUPRO</span>
              </td>
            </tr>
  
            <tr>
              <td style="background:#fff7ed;padding:16px;text-align:center;border-bottom:1px solid #fed7aa;">
                <span style="color:#ea580c;font-weight:700;font-size:13px;letter-spacing:1px;">
                  🥩 EXCEL BÁSICO — ACCESO CONFIRMADO
                </span>
              </td>
            </tr>
  
            <tr>
              <td style="padding:40px 40px 24px;">
                <h1 style="margin:0 0 12px;font-size:24px;font-weight:900;color:#0f172a;">
                  ¡Bienvenido a SoluPro, ${email.split("@")[0]}!
                </h1>
                <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
                  Tu pago fue confirmado. Ya tienes acceso completo al curso 
                  <strong>Excel Básico: El Beef 🥩</strong>.
                </p>
  
                <div style="background:#f1f5f9;border-radius:12px;padding:24px;margin-bottom:24px;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;">
                    Tus credenciales de acceso
                  </p>
                  <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Email: <strong style="color:#0f172a;">${email}</strong></p>
                  <p style="margin:0;color:#64748b;font-size:13px;">Contraseña temporal: <strong style="color:#ea580c;font-size:16px;font-family:monospace;">${tempPassword}</strong></p>
                  <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">
                    💡 Te recomendamos cambiar tu contraseña después de ingresar.
                  </p>
                </div>
  
                <div style="text-align:center;margin-bottom:24px;">
                  <a href="https://solupro-frontend.vercel.app/login"
                    style="display:inline-block;background:linear-gradient(135deg,#f97316,#f59e0b);color:white;font-weight:900;font-size:15px;padding:16px 40px;border-radius:12px;text-decoration:none;">
                    🥩 INGRESAR A MI CURSO
                  </a>
                </div>
              </td>
            </tr>
  
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
          `
        });
        console.log(`📧 Email enviado a: ${email}`);
      }
    } catch (emailError) {
      console.error(`⚠️ Error enviando email a ${email}:`, emailError.message);
    }

    console.log(`🎉 Webhook completo: ${email} → curso ${courseId}`);

  } catch (error) {
    console.error("❌ Error crítico en webhook:", error);
  }
});

// ── INICIAR SERVIDOR ──────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`🚀 Servidor backend corriendo en el puerto ${port}`);
});