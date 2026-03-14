const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function insertLessons() {
  const client = await pool.connect();
  try {
    console.log("🚀 Insertando lecciones con IDs reales de Bunny...\n");

    // Obtener IDs de módulos
    const mods = await client.query(
      'SELECT id, order_num FROM modules WHERE course_id = 2 ORDER BY order_num'
    );
    const [mod1, mod2, mod3] = mods.rows;

    console.log(`Módulo 1 id: ${mod1.id}`);
    console.log(`Módulo 2 id: ${mod2.id}`);
    console.log(`Módulo 3 id: ${mod3.id}\n`);

    // Lecciones Módulo 1
    await client.query(`
      INSERT INTO lessons (module_id, title, bunny_video_id, order_num) VALUES
      ($1, 'Estructura de la información',           'ca9c4c68-a415-4cb7-bcfe-65d0b9e152dc', 1),
      ($1, 'Copiar y pegar sin dañar',               '06ebf0b8-ab05-49a6-8794-14017090f65b', 2),
      ($1, 'Ingreso correcto de datos',               'e610f336-90fe-48f0-a4af-aa437cb73ede', 3),
      ($1, 'Comentarios',                             '3cad0755-1056-4939-8fc1-7604f00b030e', 4),
      ($1, 'Organización de hojas',                   'f99abe8d-1ad5-4dd5-8326-de9bee3e985d', 5),
      ($1, 'Atajos',                                  '68161e17-e615-4074-930e-92c0b6defe03', 6)
    `, [mod1.id]);
    console.log("✅ Módulo 1 insertado (6 lecciones)");

    // Lecciones Módulo 2
    await client.query(`
      INSERT INTO lessons (module_id, title, bunny_video_id, order_num) VALUES
      ($1, 'Formatos numéricos',                     '16462104-6ee6-4e1a-a816-93b0ddf20a92', 1),
      ($1, 'Alineación y bordes',                    'bb66cfcf-fd92-4b1c-bc13-25d2f5eb24ac', 2),
      ($1, 'Formas',                                  '70ad5f5f-b246-4978-b47d-41841d6781ae', 3),
      ($1, 'Copiar formato',                          'f25f2cd3-8b5d-4a8f-838a-94ecdcbf50c7', 4),
      ($1, 'Formato condicional',                     '1deb1104-bebf-4b77-8984-5f3e714f4c0c', 5)
    `, [mod2.id]);
    console.log("✅ Módulo 2 insertado (5 lecciones)");

    // Lecciones Módulo 3
    await client.query(`
      INSERT INTO lessons (module_id, title, bunny_video_id, order_num) VALUES
      ($1, 'Qué es una fórmula realmente',            'c94580cf-4838-49ce-b010-57398479f6cd', 1),
      ($1, 'Funciones - La automatización',           'd2951711-80b6-48b4-a29c-ed3e68351bf0', 2),
      ($1, 'Referencias relativas y absolutas 1',     '315f6bc2-3a2d-4e2f-83f4-f699c2830798', 3),
      ($1, 'Referencias relativas y absolutas 2',     '35bb89ae-b433-4d9c-aa05-f71f8a45cb12', 4),
      ($1, 'Caso práctico real',                      'aba2d096-92a6-44b0-a1c2-4ae24289c3ca', 5),
      ($1, 'Funciones clave para validar y analizar', '218e0758-f85b-4608-8a9b-523ed629ee71', 6)
    `, [mod3.id]);
    console.log("✅ Módulo 3 insertado (6 lecciones)");

    // Verificar
    const total = await client.query(
      'SELECT COUNT(*) FROM lessons WHERE module_id IN (SELECT id FROM modules WHERE course_id = 2)'
    );
    console.log(`\n🎉 Total lecciones en DB: ${total.rows[0].count}`);

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    client.release();
    await pool.end();
    console.log("🏁 ¡Bóveda de Excel lista en Railway!");
  }
}

insertLessons();