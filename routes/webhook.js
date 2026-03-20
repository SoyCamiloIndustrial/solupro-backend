const express    = require('express');
const bcrypt     = require('bcrypt');
const pool       = require('../db');
const { Resend } = require('resend');
const router     = express.Router();
const resend     = new Resend(process.env.RESEND_API_KEY);

router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Le respondemos rápido a Wompi para que no reintente
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

    // La contraseña temporal solo se usa si el usuario es nuevo o no tiene contraseña.
    // Si ya tiene contraseña, se reutiliza null para no pisarla.
    let tempPassword = null;
    let passwordHash = null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. GUARDAR USUARIO
      const userCheck = await client.query(
        'SELECT email, password_hash FROM users WHERE email = $1',
        [email]
      );

      if (userCheck.rows.length === 0) {
        // Usuario nuevo: generar contraseña y crear registro
        tempPassword = 'SoluPro-' + Math.random().toString(36).slice(-6);
        passwordHash = await bcrypt.hash(tempPassword, 10);
        await client.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
          [email, passwordHash]
        );
        console.log('Usuario nuevo creado: ' + email);

      } else if (!userCheck.rows[0].password_hash) {
        // Usuario existente sin contraseña: asignarle una
        tempPassword = 'SoluPro-' + Math.random().toString(36).slice(-6);
        passwordHash = await bcrypt.hash(tempPassword, 10);
        await client.query(
          'UPDATE users SET password_hash = $1 WHERE email = $2',
          [passwordHash, email]
        );
        console.log('Contraseña asignada a usuario existente: ' + email);

      } else {
        // Usuario que ya tiene contraseña: no se toca.
        // tempPassword queda null → el correo le avisará que ya tiene acceso.
        console.log('Usuario recurrente, sin cambio de contraseña: ' + email);
      }

      // 2. ASIGNAR CURSO
      const courseCheck = await client.query(
        'SELECT 1 FROM user_courses WHERE email = $1 AND course_id = $2',
        [email, courseId]
      );
      if (courseCheck.rows.length === 0) {
        await client.query(
          'INSERT INTO user_courses (email, course_id) VALUES ($1, $2)',
          [email, courseId]
        );
      }

      // 3. GUARDAR TRANSACCIÓN
      const txCheck = await client.query(
        'SELECT 1 FROM transactions WHERE reference = $1',
        [reference]
      );
      if (txCheck.rows.length === 0) {
        await client.query(
          'INSERT INTO transactions (email, reference, status, amount) VALUES ($1, $2, $3, $4)',
          [email, reference, 'APPROVED', amount]
        );
      }

      await client.query('COMMIT');
      console.log('DB lista para: ' + email);
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('ROLLBACK webhook:', dbError.message);
      return;
    } finally {
      client.release();
    }

    // Construir el cuerpo del correo según si tiene contraseña nueva o ya tenía
    const passwordSection = tempPassword
      ? `<p><strong>Contrasena:</strong> ${tempPassword}</p>
         <p style="color:#6b7280;font-size:13px;">Puedes cambiarla desde tu perfil una vez que ingreses.</p>`
      : `<p>Ya tienes una contraseña registrada. Usa la que creaste anteriormente.</p>
         <p style="color:#6b7280;font-size:13px;">¿La olvidaste? Escríbenos a soporte@academia-solupro.com</p>`;

    resend.emails.send({
      from: 'Academia SoluPro <hola@academia-solupro.com>',
      to: email,
      subject: '🚀 Bienvenido a la Academia SoluPro',
      html: `<div style="font-family:sans-serif;max-width:600px;padding:20px;border:1px solid #eee;">
        <h2 style="color:#10b981;">Acceso Concedido</h2>
        <p>Tu pago fue procesado. Ya puedes ver tus clases.</p>
        <hr>
        <p><strong>Email:</strong> ${email}</p>
        ${passwordSection}
        <br>
        <a href="https://academia-solupro.com/login"
           style="background:#10b981;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
          Entrar al Panel
        </a>
      </div>`
    }).catch(err => console.error('Error correo:', err.message));

  } catch (error) {
    console.error('Error webhook:', error.message);
  }
});

module.exports = router;