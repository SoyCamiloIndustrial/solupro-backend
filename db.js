const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect()
  .then(() => console.log("🟢 PostgreSQL conectado"))
  .catch(err => console.error("🔴 Error conexión DB:", err));

module.exports = pool;
