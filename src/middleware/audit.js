const db = require('../../config/database');

/**
 * Registra una acción relevante en la bitácora inmutable de auditoría (SSD)
 * @param {Object} params
 * @param {number|null} params.usuarioId
 * @param {string|null} params.username
 * @param {string} params.accion - Acción realizada (LOGIN, CREAR_USUARIO, etc.)
 * @param {string} params.modulo - Módulo afectado (AUTH, USUARIOS, TURNOS, etc.)
 * @param {string|Object} params.detalle - Descripción o payload en JSON
 * @param {Object} [params.req] - Objeto Express Request para extraer IP
 */
function registrarAuditoria({ usuarioId, username, accion, modulo, detalle, req = null }) {
  try {
    let ip = '127.0.0.1';
    if (req) {
      ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';
    }

    const detalleTexto = typeof detalle === 'object' ? JSON.stringify(detalle) : String(detalle || '');

    const stmt = db.prepare(`
      INSERT INTO auditoria (usuario_id, username, accion, modulo, detalle, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      usuarioId || null,
      username || 'ANÓNIMO',
      accion,
      modulo,
      detalleTexto,
      ip
    );
  } catch (error) {
    console.error('[AUDITORIA] Error registrando evento:', error.message);
  }
}

module.exports = {
  registrarAuditoria
};
