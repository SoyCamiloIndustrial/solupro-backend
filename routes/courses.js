// ── routes/courses.js (v8.1 — Bunny signed tokens) ───────────────────────
const express          = require('express');
const pool             = require('../db');
const requireAuth      = require('../middleware/auth');
const { signBunnyUrl } = require('../utils/bunny');
const router           = express.Router();

// GET /api/my-courses
router.get('/my-courses', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description
       FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE LOWER(uc.email) = $1`,
      [req.userEmail]
    );
    res.json({ success: true, courses: result.rows });
  } catch (error) {
    console.error('Error my-courses:', error.message);
    res.status(500).json({ error: 'Error al cargar cursos' });
  }
});

// GET /api/curriculum/:courseId
// Ownership check + URL firmada por lección con TTL de 4h
router.get('/curriculum/:courseId', requireAuth, async (req, res) => {
  const courseIdInt = parseInt(req.params.courseId, 10);
  if (isNaN(courseIdInt))
    return res.status(400).json({ error: 'courseId invalido' });

  try {
    // 1. Verificar que el usuario compró este curso
    const access = await pool.query(
      `SELECT 1 FROM user_courses
       WHERE LOWER(email) = $1 AND course_id = $2`,
      [req.userEmail, courseIdInt]
    );
    if (access.rows.length === 0)
      return res.status(403).json({ error: 'No tienes acceso a este curso' });

    // 2. Traer lecciones con progreso del usuario
    const result = await pool.query(
      `SELECT
         l.id,
         l.title,
         l.bunny_video_id,
         l.order_num       AS order_index,
         CASE WHEN p.lesson_id IS NOT NULL THEN true ELSE false END AS completed
       FROM lessons l
       LEFT JOIN lesson_progress p
         ON p.lesson_id = l.id AND LOWER(p.email) = $1
       WHERE l.course_id = $2
       ORDER BY l.order_num ASC`,
      [req.userEmail, courseIdInt]
    );

    // 3. Firmar cada URL con TTL 4h — el frontend nunca recibe el UUID crudo
    const lessons = result.rows.map(lesson => ({
      id:          lesson.id,
      title:       lesson.title,
      order_index: lesson.order_index,
      completed:   lesson.completed,
      video_url:   signBunnyUrl(lesson.bunny_video_id),
    }));

    res.json({ success: true, lessons });
  } catch (error) {
    console.error('Error curriculum:', error.message);
    res.status(500).json({ error: 'Error al cargar contenido' });
  }
});

// POST /api/progress — marca lección como completada
router.post('/progress', requireAuth, async (req, res) => {
  const { lesson_id } = req.body;
  if (!lesson_id)
    return res.status(400).json({ error: 'lesson_id requerido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query(
      `SELECT l.id FROM lessons l
       JOIN user_courses uc ON uc.course_id = l.course_id
       WHERE l.id = $1 AND LOWER(uc.email) = $2`,
      [lesson_id, req.userEmail]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Leccion no encontrada o sin acceso' });
    }

    await client.query(
      `INSERT INTO lesson_progress (email, lesson_id, completed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email, lesson_id) DO NOTHING`,
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
