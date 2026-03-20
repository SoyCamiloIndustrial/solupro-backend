const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

// ==========================================
// 1. LOGIN MANUAL (Para usuarios recurrentes)
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contrasena requeridos' });

    const cleanEmail = email.toLowerCase().trim();
    const result = await pool.query(
      'SELECT email, password_hash FROM users WHERE LOWER(email) = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const user = result.rows[0];
    if (!user.password_hash)
      return res.status(401).json({ error: 'Cuenta sin contrasena. Contacta soporte.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { email: cleanEmail },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );
    res.json({ success: true, token });
  } catch (error) {
    console.error('Error login:', error.message);
    res.status(500).json({ error: 'Error interno' });
  }
});


// ==========================================
// 2. AUTO-LOGIN (Fricción Cero post-compra)
// ==========================================
router.post('/auto-login', async (req, res) => {
  try {
    const { transaction_id, email } = req.body;

    // 1. Si no hay ID de Wompi, no hay acceso.
    if (!transaction_id) {
      return res.status(400).json({ error: 'Transacción no válida' });
    }

    // 2. Le preguntamos a Wompi directamente por esta transacción
    const wompiRes = await fetch(`https://production.wompi.co/v1/transactions/${transaction_id}`);
    const wompiData = await wompiRes.json();

    if (!wompiRes.ok || !wompiData.data) {
      return res.status(400).json({ error: 'No se pudo verificar el pago en Wompi' });
    }

    const tx = wompiData.data;

    // 3. Verificamos que el pago esté APROBADO
    if (tx.status !== 'APPROVED') {
      return res.status(400).json({ error: 'El pago no está aprobado aún' });
    }

    // 4. Tomamos el correo DIRECTAMENTE de Wompi (100% seguro)
    const correoDefinitivo = (tx.customer_email || email || "").toLowerCase().trim();

    if (!correoDefinitivo) {
      return res.status(400).json({ error: 'No se pudo obtener el correo del comprador' });
    }

    // 5. Generamos el pase VIP
    const token = jwt.sign(
      { email: correoDefinitivo },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );
    
    // Devolvemos el token y el email real usado en Wompi
    res.json({ success: true, token, email: correoDefinitivo });

  } catch (error) {
    console.error('Error en auto-login seguro:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;