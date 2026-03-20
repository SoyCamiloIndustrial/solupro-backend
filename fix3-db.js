require('dotenv').config();
const { Client } = require('pg');

// Nos conectamos usando la URL de tu base de datos en Railway
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function arreglarBaseDeDatos() {
  try {
    console.log("Conectando a la base de datos en Railway...");
    await client.connect();
    
    // Inyectamos el comando SQL
    const query = 'ALTER TABLE users ADD CONSTRAINT unique_email UNIQUE (email);';
    await client.query(query);
    
    console.log("🔥 ¡CORONAMOS! La columna email ahora es ÚNICA. Ya puedes vender.");
  } catch (error) {
    // Si da error de duplicidad (código 23505 en Postgres)
    if (error.code === '23505') {
      console.log("⚠️ ALERTA: El comando falló porque YA TIENES correos repetidos en la tabla.");
      console.log("Solución: Entra a tu base de datos, borra los usuarios de prueba repetidos, y vuelve a correr este script.");
    } else {
      console.error("❌ Error inesperado:", error.message);
    }
  } finally {
    await client.end();
  }
}

arreglarBaseDeDatos();