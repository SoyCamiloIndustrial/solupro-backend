# =============================================================================
# deploy-v8-full.ps1 — Escribe todos los archivos v8.0 y despliega
# Uso: cd "C:\Users\Camilo Peña\solupro-backend" ; .\deploy-v8-full.ps1
# =============================================================================

$BACKEND = "C:\Users\Camilo Peña\solupro-backend"
Set-Location $BACKEND

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  SOLUPRO v8.0 — DEPLOY AUTOMATIZADO  " -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# ── PASO 1: Crear carpetas ────────────────────────────────────────────────
Write-Host "`n📁 [1/7] Creando estructura..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "$BACKEND\middleware" | Out-Null
New-Item -ItemType Directory -Force -Path "$BACKEND\routes"     | Out-Null
Write-Host "   ✅ middleware/ routes/ listos" -ForegroundColor Green

# ── PASO 2: Escribir archivos ─────────────────────────────────────────────
Write-Host "`n📝 [2/7] Escribiendo archivos v8.0..." -ForegroundColor Yellow

# ── index.js ──────────────────────────────────────────────────────────────
@"
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRouter    = require('./routes/auth');
const coursesRouter = require('./routes/courses');
const webhookRouter = require('./routes/webhook');

const app = express();

app.use(cors({
  origin: [
    "https://academia-solupro.com",
    "https://solupro-frontend.vercel.app",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

app.get("/", (req, res) => res.send("🚀 Academia SoluPro API v8.0 Online"));

app.use("/api", authRouter);
app.use("/api", coursesRouter);
app.use("/api", webhookRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 SoluPro v8.0 listo en puerto `+PORT));
"@ | Set-Content -Encoding UTF8 "$BACKEND\index.js"
Write-Host "   ✅ index.js" -ForegroundColor Green

# ── db.js ──────────────────────────────────────────────────────────────────
@"
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
module.exports = pool;
"@ | Set-Content -Encoding UTF8 "$BACKEND\db.js"
Write-Host "   ✅ db.js" -ForegroundColor Green

# ── middleware/auth.js ─────────────────────────────────────────────────────
@"
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.userEmail = payload.email.toLowerCase().trim();
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

module.exports = requireAuth;
"@ | Set-Content -Encoding UTF8 "$BACKEND\middleware\auth.js"
Write-Host "   ✅ middleware/auth.js" -ForegroundColor Green

# ── routes/auth.js ─────────────────────────────────────────────────────────
@"
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contrasena requeridos' });
    const cleanEmail = email.toLowerCase().trim();
    const result = await pool.query(
      'SELECT email, password_hash FROM users WHERE LOWER(email) = `$1`',
      [cleanEmail]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const user = result.rows[0];
    if (!user.password_hash) return res.status(401).json({ error: 'Cuenta sin contrasena. Contacta soporte.' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign({ email: cleanEmail }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (error) {
    console.error('Error login:', error.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/auto-login', (req, res) => {
  if (!req.body.email) return res.status(400).json({ error: 'Email requerido' });
  const token = jwt.sign(
    { email: req.body.email.toLowerCase().trim() },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '7d' }
  );
  res.json({ success: true, token });
});

module.exports = router;
"@ | Set-Content -Encoding UTF8 "$BACKEND\routes\auth.js"
Write-Host "   ✅ routes/auth.js" -ForegroundColor Green

# ── routes/courses.js ──────────────────────────────────────────────────────
@"
const express     = require('express');
const pool        = require('../db');
const requireAuth = require('../middleware/auth');
const router      = express.Router();

router.get('/my-courses', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description
       FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE LOWER(uc.email) = `+"`$1`",
      [req.userEmail]
    );
    res.json({ success: true, courses: result.rows });
  } catch (error) {
    console.error('Error my-courses:', error.message);
    res.status(500).json({ error: 'Error al cargar cursos' });
  }
});

router.get('/curriculum/:courseId', requireAuth, async (req, res) => {
  const courseIdInt = parseInt(req.params.courseId, 10);
  if (isNaN(courseIdInt)) return res.status(400).json({ error: 'courseId invalido' });
  try {
    const access = await pool.query(
      'SELECT 1 FROM user_courses WHERE LOWER(email) = `$1` AND course_id = `$2`',
      [req.userEmail, courseIdInt]
    );
    if (access.rows.length === 0) return res.status(403).json({ error: 'No tienes acceso a este curso' });

    const result = await pool.query(
      `SELECT l.id, l.title,
              l.bunny_video_id AS video_url,
              l.order_num      AS order_index,
              CASE WHEN p.lesson_id IS NOT NULL THEN true ELSE false END AS completed
       FROM lessons l
       LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND LOWER(p.email) = `+"`$1`"+`
       WHERE l.course_id = `+"`$2`"+`
       ORDER BY l.order_num ASC`,
      [req.userEmail, courseIdInt]
    );
    res.json({ success: true, lessons: result.rows });
  } catch (error) {
    console.error('Error curriculum:', error.message);
    res.status(500).json({ error: 'Error al cargar contenido' });
  }
});

router.post('/progress', requireAuth, async (req, res) => {
  const { lesson_id } = req.body;
  if (!lesson_id) return res.status(400).json({ error: 'lesson_id requerido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query(
      `SELECT l.id FROM lessons l
       JOIN user_courses uc ON uc.course_id = l.course_id
       WHERE l.id = `+"`$1`"+` AND LOWER(uc.email) = `+"`$2`",
      [lesson_id, req.userEmail]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Leccion no encontrada o sin acceso' });
    }
    await client.query(
      `INSERT INTO lesson_progress (email, lesson_id, completed_at)
       VALUES (`+"`$1`, `$2`"+`, NOW()) ON CONFLICT (email, lesson_id) DO NOTHING`,
      [req.userEmail, lesson_id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Progreso guardado' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error progress:', error.message);
    res.status(500).json({ error: 'Error al guardar progreso' });
  } finally {
    client.release();
  }
});

module.exports = router;
"@ | Set-Content -Encoding UTF8 "$BACKEND\routes\courses.js"
Write-Host "   ✅ routes/courses.js" -ForegroundColor Green

# ── routes/webhook.js ──────────────────────────────────────────────────────
@"
const express    = require('express');
const bcrypt     = require('bcrypt');
const pool       = require('../db');
const { Resend } = require('resend');
const router     = express.Router();
const resend     = new Resend(process.env.RESEND_API_KEY);

router.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const { event, data } = req.body;
    if (event !== 'transaction.updated') return;
    const transaction = data?.transaction;
    if (!transaction || transaction.status !== 'APPROVED') return;

    const email     = transaction.customer_email?.toLowerCase().trim();
    const reference = transaction.reference;
    const amount    = transaction.amount_in_cents;
    const courseId  = 2;
    if (!email) return;

    const tempPassword = 'SoluPro-' + Math.random().toString(36).slice(-6);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    console.log('Procesando acceso para: ' + email);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (email, password_hash) VALUES (`+"`$1`, `$2`"+`)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         WHERE users.password_hash IS NULL`,
        [email, passwordHash]
      );
      await client.query(
        'INSERT INTO user_courses (email, course_id) VALUES (`$1`, `$2`) ON CONFLICT DO NOTHING',
        [email, courseId]
      );
      await client.query(
        `INSERT INTO transactions (email, reference, status, amount)
         VALUES (`+"`$1`, `$2`"+`, 'APPROVED', `+"`$3`"+`) ON CONFLICT DO NOTHING`,
        [email, reference, amount]
      );
      await client.query('COMMIT');
      console.log('DB lista para: ' + email);
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('ROLLBACK webhook:', dbError.message);
      return;
    } finally {
      client.release();
    }

    resend.emails.send({
      from: 'Academia SoluPro <hola@academia-solupro.com>',
      to: email,
      subject: 'Bienvenido a la Academia SoluPro',
      html: '<div style="font-family:sans-serif;max-width:600px;padding:20px;border:1px solid #eee;"><h2 style="color:#10b981;">Acceso Concedido</h2><p>Tu pago fue procesado. Ya puedes ver tus clases.</p><hr><p><strong>Email:</strong> ' + email + '</p><p><strong>Contrasena:</strong> ' + tempPassword + '</p><br><a href="https://academia-solupro.com/login" style="background:#10b981;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Entrar al Panel</a></div>'
    }).catch(err => console.error('Error correo:', err.message));

  } catch (error) {
    console.error('Error webhook:', error.message);
  }
});

module.exports = router;
"@ | Set-Content -Encoding UTF8 "$BACKEND\routes\webhook.js"
Write-Host "   ✅ routes/webhook.js" -ForegroundColor Green

# ── migrate-v8.js ──────────────────────────────────────────────────────────
@"
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Ejecutando migracion v8.0...');
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lesson_progress (
        id           SERIAL PRIMARY KEY,
        email        TEXT        NOT NULL,
        lesson_id    INTEGER     NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (email, lesson_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_progress_email ON lesson_progress (email);');
    await client.query('COMMIT');
    console.log('Migracion v8.0 completada.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error migracion:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
migrate();
"@ | Set-Content -Encoding UTF8 "$BACKEND\migrate-v8.js"
Write-Host "   ✅ migrate-v8.js" -ForegroundColor Green

# ── fix-admin-password.js ──────────────────────────────────────────────────
@"
require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fixPassword() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, email, password, password_hash FROM users WHERE LOWER(email) = 'solupropro@gmail.com'"
    );
    if (result.rows.length === 0) { console.log('Usuario no encontrado.'); process.exit(1); }
    const user = result.rows[0];
    if (!user.password || user.password.startsWith('`$2b`$')) {
      console.log('Ya hasheada o vacia. Nada que hacer.'); process.exit(0);
    }
    console.log('Hasheando con salt_rounds=12...');
    const newHash = await bcrypt.hash(user.password, 12);
    await client.query('BEGIN');
    await client.query(
      "UPDATE users SET password_hash = `$1`, password = NULL WHERE LOWER(email) = 'solupropro@gmail.com'",
      [newHash]
    );
    await client.query('COMMIT');
    console.log('password_hash actualizado. Campo password limpiado.');
    console.log('IMPORTANTE: Elimina este archivo del repo ahora.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
fixPassword();
"@ | Set-Content -Encoding UTF8 "$BACKEND\fix-admin-password.js"
Write-Host "   ✅ fix-admin-password.js" -ForegroundColor Green

# ── PASO 3: Migrar DB ─────────────────────────────────────────────────────
Write-Host "`n🗄️  [3/7] Migrando base de datos..." -ForegroundColor Yellow
node migrate-v8.js

# ── PASO 4: Hashear contraseña admin ─────────────────────────────────────
Write-Host "`n🔐 [4/7] Hasheando contrasena admin..." -ForegroundColor Yellow
node fix-admin-password.js

# ── PASO 5: Git add + commit + push ──────────────────────────────────────
Write-Host "`n🚀 [5/7] Commiteando y pusheando a Railway..." -ForegroundColor Yellow
git add .
git commit -m "feat: v8.0 - refactor modular, JWT middleware, progress tracking, transacciones"
git push origin main

# ── PASO 6: Eliminar script de seguridad ─────────────────────────────────
Write-Host "`n🧹 [6/7] Eliminando fix-admin-password.js del repo..." -ForegroundColor Yellow
git rm --force fix-admin-password.js
git commit -m "security: remove one-time password fix script"
git push origin main

# ── PASO 7: Verificar ────────────────────────────────────────────────────
Write-Host "`n🔍 [7/7] Verificando deploy (espera 35s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 35

$response = Invoke-RestMethod -Uri "https://solupro-backend-production-00f5.up.railway.app/" -Method GET

Write-Host ""
if ($response -like "*v8.0*") {
  Write-Host "=======================================" -ForegroundColor Green
  Write-Host "   ✅  v8.0 DESPLEGADO EXITOSAMENTE   " -ForegroundColor Green
  Write-Host "=======================================" -ForegroundColor Green
} else {
  Write-Host "Respuesta: $response" -ForegroundColor White
  Write-Host "⚠️  Railway aun esta desplegando. Verifica en 1 minuto." -ForegroundColor Red
}
Write-Host ""
