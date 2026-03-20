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

    const tempPassword = 'SoluPro-' + Math.random().toString(36).slice(-6);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    console.log('Procesando acceso para: ' + email);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. GUARDAR USUARIO (Sin usar ON CONFLICT)
      const userCheck = await client.query('SELECT email, password_hash FROM users WHERE email = $1', [email]);
      if (userCheck.rows.length === 0) {
        // Si no existe, lo creamos
        await client.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
          [email, passwordHash]
        );
      } else if (!userCheck.rows[0].password_hash) {
        // Si existe pero no tiene contraseña, se la actualizamos
        await client.query(
          'UPDATE users SET password_hash = $2 WHERE email = $1',
          [email, passwordHash]
        );
      }

      // 2. ASIGNAR CURSO (Sin usar ON CONFLICT)
      const courseCheck = await client.query('SELECT 1 FROM user_courses WHERE email = $1 AND course_id = $2', [email, courseId]);
      if (courseCheck.rows.length === 0) {
        await client.query(
          'INSERT INTO user_courses (email, course_id) VALUES ($1, $2)',
          [email, courseId]
        );
      }

      // 3. GUARDAR TRANSACCIÓN (Sin usar ON CONFLICT)
      const txCheck = await client.query('SELECT 1 FROM transactions WHERE reference = $1', [reference]);
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

    // Enviar correo con credenciales
    resend.emails.send({
      from: 'Academia SoluPro <hola@academia-solupro.com>',
      to: email,
      subject: '🚀 Bienvenido a la Academia SoluPro',
      html: `<div style="font-family:sans-serif;max-width:600px;padding:20px;border:1px solid #eee;">
        <h2 style="color:#10b981;">Acceso Concedido</h2>
        <p>Tu pago fue procesado. Ya puedes ver tus clases.</p>
        <hr>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Contrasena:</strong> ${tempPassword}</p>
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