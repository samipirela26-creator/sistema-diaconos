const db = require('../../config/database');
const { ok, fallo } = require('../helpers/respuesta');
const { registrarAuditoria } = require('../middleware/audit');

const avisoController = {
  /**
   * Listar avisos y comunicados para los diáconos
   * GET /api/avisos
   */
  listar(req, res) {
    try {
      const stmt = db.prepare(`
        SELECT 
          a.id, a.titulo, a.contenido, a.tipo, a.fijado, a.created_at,
          u.nombre_completo as autor_nombre, u.rol as autor_rol
        FROM avisos a
        LEFT JOIN usuarios u ON a.creado_por = u.id
        ORDER BY a.fijado DESC, a.id DESC
      `);

      const avisos = stmt.all();
      return ok(res, avisos, 'Avisos del ministerio recuperados');
    } catch (error) {
      console.error('Error al listar avisos:', error);
      return fallo(res, 'Error al obtener los avisos', 500);
    }
  },

  /**
   * Publicar nuevo aviso (Líder o Root)
   * POST /api/avisos
   */
  crear(req, res) {
    try {
      const { titulo, contenido, tipo = 'general', fijado = 0 } = req.body;

      if (!titulo || !contenido) {
        return fallo(res, 'El título y el contenido del comunicado son obligatorios', 400);
      }

      if (!['general', 'importante', 'urgente'].includes(tipo)) {
        return fallo(res, 'Tipo de aviso inválido', 400);
      }

      const stmt = db.prepare(`
        INSERT INTO avisos (titulo, contenido, tipo, fijado, creado_por)
        VALUES (?, ?, ?, ?, ?)
      `);

      const resultado = stmt.run(
        titulo.trim(),
        contenido.trim(),
        tipo,
        fijado ? 1 : 0,
        req.usuario.id
      );

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'CREAR_AVISO',
        modulo: 'AVISOS',
        detalle: `Aviso publicado: [${titulo}] (${tipo})`,
        req
      });

      return ok(res, { id: resultado.lastInsertRowid, titulo }, 'Comunicado publicado con éxito', 201);
    } catch (error) {
      console.error('Error al crear aviso:', error);
      return fallo(res, 'Error al publicar el aviso', 500);
    }
  },

  /**
   * Eliminar aviso
   * DELETE /api/avisos/:id
   */
  eliminar(req, res) {
    try {
      const { id } = req.params;

      const aviso = db.prepare('SELECT id, titulo FROM avisos WHERE id = ?').get(id);
      if (!aviso) {
        return fallo(res, 'Aviso no encontrado', 404);
      }

      db.prepare('DELETE FROM avisos WHERE id = ?').run(id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'ELIMINAR_AVISO',
        modulo: 'AVISOS',
        detalle: `Aviso eliminado: [${aviso.titulo}]`,
        req
      });

      return ok(res, null, 'Aviso eliminado correctamente');
    } catch (error) {
      console.error('Error al eliminar aviso:', error);
      return fallo(res, 'Error al eliminar el aviso', 500);
    }
  }
};

module.exports = avisoController;
