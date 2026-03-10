require("dotenv").config();

const pool = require("./db");
const bcrypt = require("bcrypt");

async function createUser() {

  const email = "test@test.com";
  const password = "123456";

  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `
    INSERT INTO users (email, password)
    VALUES ($1, $2)
    `,
    [email, hash]
  );

  console.log("✅ Usuario creado");

  process.exit();

}

createUser();
console.log(process.env.DATABASE_URL);
