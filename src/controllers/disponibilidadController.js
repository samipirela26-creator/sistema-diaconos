const db = require('../../config/database');
const { ok, fallo } = require('../helpers/respuesta');
const { registrarAuditoria } = require('../middleware/audit');

const disponibilidadController = {
  /**
   * Listar fechas no disponibles
   * GET /api/disponibilidad?fecha=YYYY-MM-DD
   */
  listar(req, res) {
    try {
      const { fecha } = req.query;

      if (req.usuario.rol === 'diacono') {
        // Un diácono ve sus propias fechas de indisponibilidad
        const stmt = db.prepare(`
          SELECT id, fecha, motivo, created_at
          FROM disponibilidad
          WHERE usuario_id = ?
          ORDER BY fecha ASC
        `);
        return ok(res, stmt.all(req.usuario.id), 'Tus fechas de indisponibilidad');
      }

      // Líder y Root pueden consultar por fecha o ver todos los diáconos ausentes
      let sql = `
        SELECT 
          d.id, d.fecha, d.motivo, d.created_at,
          u.id as usuario_id, u.nombre_completo, u.telefono
        FROM disponibilidad d
        JOIN usuarios u ON d.usuario_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (fecha) {
        sql += ' AND d.fecha = ?';
        params.push(fecha);
      }

      sql += ' ORDER BY d.fecha ASC, u.nombre_completo ASC';

      const listado = db.prepare(sql).all(...params);
      return ok(res, listado, 'Registros de indisponibilidad');
    } catch (error) {
      console.error('Error al consultar disponibilidad:', error);
      return fallo(res, 'Error al consultar disponibilidad', 500);
    }
  },

  /**
   * Registrar que no estará disponible en una fecha
   * POST /api/disponibilidad
   */
  registrar(req, res) {
    try {
      const { fecha, motivo } = req.body;

      if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return fallo(res, 'Debe especificar una fecha válida (YYYY-MM-DD)', 400);
      }

      // Evitar duplicado para ese usuario y fecha
      const existente = db.prepare('SELECT id FROM disponibilidad WHERE usuario_id = ? AND fecha = ?').get(req.usuario.id, fecha);
      if (existente) {
        return fallo(res, 'Ya habías registrado indisponibilidad para esta fecha', 400);
      }

      const stmt = db.prepare(`
        INSERT INTO disponibilidad (usuario_id, fecha, motivo)
        VALUES (?, ?, ?)
      `);

      const resultado = stmt.run(req.usuario.id, fecha, motivo ? motivo.trim() : 'No disponible');

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'REGISTRAR_INDISPONIBILIDAD',
        modulo: 'DISPONIBILIDAD',
        detalle: `Fecha: ${fecha} - Motivo: ${motivo || 'Sin detalle'}`,
        req
      });

      return ok(res, { id: resultado.lastInsertRowid, fecha }, 'Indisponibilidad registrada con éxito', 201);
    } catch (error) {
      console.error('Error al registrar indisponibilidad:', error);
      return fallo(res, 'Error al registrar tu indisponibilidad', 500);
    }
  },

  /**
   * Eliminar aviso de indisponibilidad (vuelve a estar disponible)
   * DELETE /api/disponibilidad/:id
   */
  eliminar(req, res) {
    try {
      const { id } = req.params;

      const registro = db.prepare('SELECT * FROM disponibilidad WHERE id = ?').get(id);
      if (!registro) {
        return fallo(res, 'Registro no encontrado', 404);
      }

      // Diácono solo puede eliminar sus propios registros
      if (req.usuario.rol === 'diacono' && registro.usuario_id !== req.usuario.id) {
        return fallo(res, 'No puedes eliminar la indisponibilidad de otro hermano', 403);
      }

      db.prepare('DELETE FROM disponibilidad WHERE id = ?').run(id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'REMOVER_INDISPONIBILIDAD',
        modulo: 'DISPONIBILIDAD',
        detalle: `Se liberó la fecha ${registro.fecha}`,
        req
      });

      return ok(res, null, 'Fecha liberada. Ya figuras disponible para asignaciones.');
    } catch (error) {
      console.error('Error al eliminar indisponibilidad:', error);
      return fallo(res, 'Error al actualizar disponibilidad', 500);
    }
  }
};

module.exports = disponibilidadController;
