const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  const client = await pool.connect();
  try {
    const users = await client.query(
      `SELECT id, email FROM users WHERE password_hash IS NULL`
    );

    for (const user of users.rows) {
      const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      const temp = "SoluPro-" + Array.from(
        { length: 6 },
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join("");
      const hash = await bcrypt.hash(temp, 10);
      await client.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [hash, user.id]
      );
      console.log(`✅ ${user.email} → ${temp}`);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fix();