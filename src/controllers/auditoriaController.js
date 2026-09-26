const db = require('../../config/database');
const { ok, fallo } = require('../helpers/respuesta');

const auditoriaController = {
  /**
   * Listar registros de auditoría
   * GET /api/auditoria?modulo=...&limite=50&offset=0
   */
  listar(req, res) {
    try {
      const { modulo, accion, limite = 50, offset = 0 } = req.query;

      let sql = 'SELECT * FROM auditoria WHERE 1=1';
      const params = [];

      if (modulo) {
        sql += ' AND modulo = ?';
        params.push(modulo.toUpperCase());
      }
      if (accion) {
        sql += ' AND accion LIKE ?';
        params.push(`%${accion}%`);
      }

      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(Math.min(parseInt(limite) || 50, 200), parseInt(offset) || 0);

      const logs = db.prepare(sql).all(...params);
      const total = db.prepare('SELECT COUNT(*) as total FROM auditoria').get().total;

      return ok(res, { logs, total }, 'Registros de auditoría recuperados');
    } catch (error) {
      console.error('Error al consultar auditoría:', error);
      return fallo(res, 'Error al obtener la bitácora de auditoría', 500);
    }
  }
};

module.exports = auditoriaController;
