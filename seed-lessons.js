/**
 * seed-lessons.js — Reemplaza las lecciones de la DB con los IDs reales de Bunny
 * Uso: node seed-lessons.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── DATOS REALES EXTRAÍDOS DE BUNNY API ──────────────────────────────────
// course_id = 2 (Excel Básico: El Beef)
const COURSE_ID = 2;

const lessons = [
  // ── MÓDULO 1 ────────────────────────────────────────────────────────────
  { title: "Estructura de la información",          bunny_video_id: "ca9c4c68-a415-4cb7-bcfe-65d0b9e152dc", order_num: 1  },
  { title: "Copiar y pegar sin dañar",              bunny_video_id: "06ebf0b8-ab05-49a6-8794-14017090f65b", order_num: 2  },
  { title: "Ingreso correcto de datos",             bunny_video_id: "e610f336-90fe-48f0-a4af-aa437cb73ede", order_num: 3  },
  { title: "Comentarios",                           bunny_video_id: "3cad0755-1056-4939-8fc1-7604f00b030e", order_num: 4  },
  { title: "Organización de hojas",                 bunny_video_id: "f99abe8d-1ad5-4dd5-8326-de9bee3e985d", order_num: 5  },
  { title: "Atajos",                                bunny_video_id: "68161e17-e615-4074-930e-92c0b6defe03", order_num: 6  },

  // ── MÓDULO 2 ────────────────────────────────────────────────────────────
  { title: "Formatos numéricos",                    bunny_video_id: "16462104-6ee6-4e1a-a816-93b0ddf20a92", order_num: 7  },
  { title: "Alineación y bordes",                   bunny_video_id: "bb66cfcf-fd92-4b1c-bc13-25d2f5eb24ac", order_num: 8  },
  { title: "Formas",                                bunny_video_id: "70ad5f5f-b246-4978-b47d-41841d6781ae", order_num: 9  },
  { title: "Copiar formato",                        bunny_video_id: "f25f2cd3-8b5d-4a8f-838a-94ecdcbf50c7", order_num: 10 },
  { title: "Formato condicional",                   bunny_video_id: "1deb1104-bebf-4b77-8984-5f3e714f4c0c", order_num: 11 },

  // ── MÓDULO 3 ────────────────────────────────────────────────────────────
  { title: "Qué es una fórmula realmente",          bunny_video_id: "c94580cf-4838-49ce-b010-57398479f6cd", order_num: 12 },
  { title: "Funciones (la automatización)",         bunny_video_id: "d2951711-80b6-48b4-a29c-ed3e68351bf0", order_num: 13 },
  { title: "Referencias relativas y absolutas",     bunny_video_id: "315f6bc2-3a2d-4e2f-83f4-f699c2830798", order_num: 14 },
  { title: "Referencias relativas y absolutas 2",   bunny_video_id: "35bb89ae-b433-4d9c-aa05-f71f8a45cb12", order_num: 15 },
  { title: "Caso práctico real",                    bunny_video_id: "aba2d096-92a6-44b0-a1c2-4ae24289c3ca", order_num: 16 },
  { title: "Funciones clave para validar y analizar", bunny_video_id: "218e0758-f85b-4608-8a9b-523ed629ee71", order_num: 17 },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🔌 Conectado. Iniciando seed de lecciones...\n');
    await client.query('BEGIN');

    // Borrar lecciones falsas del curso 2
    const deleted = await client.query(
      `DELETE FROM lessons WHERE course_id = $1`, [COURSE_ID]
    );
    console.log(`🗑️  Lecciones anteriores eliminadas: ${deleted.rowCount}`);

    // Insertar las reales
    for (const lesson of lessons) {
      await client.query(
        `INSERT INTO lessons (course_id, title, bunny_video_id, order_num)
         VALUES ($1, $2, $3, $4)`,
        [COURSE_ID, lesson.title, lesson.bunny_video_id, lesson.order_num]
      );
      console.log(`✅ ${lesson.order_num}. ${lesson.title}`);
    }

    await client.query('COMMIT');
    console.log(`\n🎉 ${lessons.length}/17 lecciones insertadas correctamente.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error, ROLLBACK aplicado:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();