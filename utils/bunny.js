// ── utils/bunny.js ────────────────────────────────────────────────────────
// Genera URLs firmadas para Bunny Stream embed (Embed View Token Auth)
// Algoritmo oficial: SHA256(tokenKey + videoId + expires) → hex string
//
// Variables de entorno necesarias en Railway:
//   BUNNY_TOKEN_KEY   — clave de autenticación de tokens (ver abajo cómo obtenerla)
//   BUNNY_LIBRARY_ID  — 617095

const crypto = require('crypto');

const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '617095';
const BUNNY_TOKEN_KEY  = process.env.BUNNY_TOKEN_KEY;  // obligatorio en producción

// TTL por defecto: 4 horas. Suficiente para ver una clase completa
// sin ser tan largo que un link filtrado sea útil.
const DEFAULT_TTL_SECONDS = 4 * 60 * 60;

/**
 * Genera una URL de embed firmada para Bunny Stream.
 *
 * @param {string} videoId   — UUID del video en Bunny (bunny_video_id)
 * @param {number} ttl       — segundos de validez (default: 4h)
 * @returns {string}         — URL firmada lista para el iframe
 */
function signBunnyUrl(videoId, ttl = DEFAULT_TTL_SECONDS) {
  if (!BUNNY_TOKEN_KEY) {
    // En desarrollo sin clave, devuelve URL sin firmar
    // NUNCA llega a producción porque Railway tiene la variable
    console.warn('⚠️  BUNNY_TOKEN_KEY no configurada — URL sin firmar (solo desarrollo)');
    return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}?autoplay=false&preload=true&responsive=true`;
  }

  const expires = Math.floor(Date.now() / 1000) + ttl;

  // Hash: SHA256(tokenKey + videoId + expires) en hex
  const hashInput = `${BUNNY_TOKEN_KEY}${videoId}${expires}`;
  const token = crypto
    .createHash('sha256')
    .update(hashInput)
    .digest('hex');

  return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}?token=${token}&expires=${expires}&autoplay=false&preload=true&responsive=true`;
}

module.exports = { signBunnyUrl };
