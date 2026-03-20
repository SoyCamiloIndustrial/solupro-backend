require('dotenv').config();
const { Client } = require('pg');

// Nos conectamos usando la URL de tu base de datos en Railway
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function arreglarLeads() {
  try {
    console.log("Conectando a la base de datos en Railway...");
    await client.connect();
    
    // Inyectamos el comando SQL para la tabla LEADS
    const query = 'ALTER TABLE leads ADD CONSTRAINT unique_email_leads UNIQUE (email);';
    await client.query(query);
    
    console.log("🔥 ¡CORONAMOS! La columna email en la tabla LEADS ahora es ÚNICA.");
  } catch (error) {
    if (error.code === '23505') {
      console.log("⚠️ ALERTA: El comando falló porque YA TIENES correos repetidos en la tabla leads.");
    } else if (error.code === '42P07' || error.message.includes('already exists')) {
      console.log("✅ El candado ya existe, todo está en orden.");
    } else {
      console.error("❌ Error inesperado:", error.message);
    }
  } finally {
    await client.end();
  }
}

arreglarLeads();