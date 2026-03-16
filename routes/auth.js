const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

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

router.post('/auto-login', (req, res) => {
  if (!req.body.email)
    return res.status(400).json({ error: 'Email requerido' });
  const token = jwt.sign(
    { email: req.body.email.toLowerCase().trim() },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '7d' }
  );
  res.json({ success: true, token });
});

module.exports = router;
