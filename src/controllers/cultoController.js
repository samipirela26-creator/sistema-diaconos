const db = require('../../config/database');
const { ok, fallo } = require('../helpers/respuesta');
const { registrarAuditoria } = require('../middleware/audit');

const cultoController = {
  /**
   * Listar cultos y eventos
   * GET /api/cultos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=...
   */
  listar(req, res) {
    try {
      const { desde, hasta, estado } = req.query;

      let sql = `
        SELECT 
          c.id, c.titulo, c.fecha, c.hora_inicio, c.hora_fin, c.tipo, c.descripcion, c.estado, c.created_at,
          u.nombre_completo as creador_nombre,
          (SELECT COUNT(*) FROM turnos_asignados t WHERE t.culto_id = c.id) as total_diaconos_asignados,
          (SELECT COUNT(*) FROM turnos_asignados t WHERE t.culto_id = c.id AND t.estado_asistencia = 'confirmado') as total_confirmados,
          (SELECT COUNT(*) FROM reportes_culto r WHERE r.culto_id = c.id) as tiene_reporte
        FROM cultos_eventos c
        LEFT JOIN usuarios u ON c.creado_por = u.id
        WHERE 1=1
      `;
      const params = [];

      if (desde) {
        sql += ' AND c.fecha >= ?';
        params.push(desde);
      }
      if (hasta) {
        sql += ' AND c.fecha <= ?';
        params.push(hasta);
      }
      if (estado) {
        sql += ' AND c.estado = ?';
        params.push(estado);
      }

      sql += ' ORDER BY c.fecha DESC, c.hora_inicio ASC';

      const cultos = db.prepare(sql).all(...params);
      return ok(res, cultos, 'Cultos y eventos recuperados');
    } catch (error) {
      console.error('Error al listar cultos:', error);
      return fallo(res, 'Error al obtener la lista de cultos', 500);
    }
  },

  /**
   * Obtener detalle completo de un culto con sus puestos y turnos
   * GET /api/cultos/:id
   */
  obtenerPorId(req, res) {
    try {
      const { id } = req.params;

      const culto = db.prepare(`
        SELECT c.*, u.nombre_completo as creador_nombre
        FROM cultos_eventos c
        LEFT JOIN usuarios u ON c.creado_por = u.id
        WHERE c.id = ?
      `).get(id);

      if (!culto) {
        return fallo(res, 'Culto o evento no encontrado', 404);
      }

      // Obtener turnos asignados a este culto
      const turnos = db.prepare(`
        SELECT 
          t.id, t.estado_asistencia, t.motivo_excusa, t.notas, t.updated_at,
          p.id as puesto_id, p.nombre as puesto_nombre,
          u.id as usuario_id, u.nombre_completo, u.telefono, u.rol
        FROM turnos_asignados t
        JOIN puestos_servicio p ON t.puesto_id = p.id
        JOIN usuarios u ON t.usuario_id = u.id
        WHERE t.culto_id = ?
        ORDER BY p.orden ASC, u.nombre_completo ASC
      `).all(id);

      // Obtener reporte si existe
      const reporte = db.prepare(`
        SELECT r.*, u.nombre_completo as registrado_por_nombre
        FROM reportes_culto r
        LEFT JOIN usuarios u ON r.registrado_por = u.id
        WHERE r.culto_id = ?
      `).get(id);

      return ok(res, {
        culto,
        turnos,
        reporte: reporte || null
      }, 'Detalle de culto obtenido');
    } catch (error) {
      console.error('Error al consultar culto:', error);
      return fallo(res, 'Error al consultar el culto', 500);
    }
  },

  /**
   * Crear nuevo culto o evento
   * POST /api/cultos
   */
  crear(req, res) {
    try {
      const { titulo, fecha, hora_inicio, hora_fin, tipo = 'culto', descripcion = '', estado = 'programado' } = req.body;

      if (!titulo || !fecha || !hora_inicio) {
        return fallo(res, 'Título, fecha y hora de inicio son requeridos', 400);
      }

      // Validar formato de fecha (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return fallo(res, 'Formato de fecha inválido. Utilice YYYY-MM-DD', 400);
      }

      const stmt = db.prepare(`
        INSERT INTO cultos_eventos (titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, estado, creado_por)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const resultado = stmt.run(
        titulo.trim(),
        fecha,
        hora_inicio,
        hora_fin || null,
        tipo,
        descripcion.trim(),
        estado,
        req.usuario.id
      );

      const nuevoId = resultado.lastInsertRowid;

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'CREAR_CULTO',
        modulo: 'CULTOS',
        detalle: `Se programó el culto [${titulo}] para la fecha [${fecha} ${hora_inicio}]`,
        req
      });

      return ok(res, { id: nuevoId, titulo, fecha, hora_inicio }, 'Culto programado con éxito', 201);
    } catch (error) {
      console.error('Error al crear culto:', error);
      return fallo(res, 'Error al programar el culto', 500);
    }
  },

  /**
   * Actualizar culto
   * PUT /api/cultos/:id
   */
  actualizar(req, res) {
    try {
      const { id } = req.params;
      const { titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, estado } = req.body;

      const actual = db.prepare('SELECT * FROM cultos_eventos WHERE id = ?').get(id);
      if (!actual) {
        return fallo(res, 'Culto no encontrado', 404);
      }

      const stmt = db.prepare(`
        UPDATE cultos_eventos
        SET titulo = ?, fecha = ?, hora_inicio = ?, hora_fin = ?, tipo = ?, descripcion = ?, estado = ?
        WHERE id = ?
      `);

      stmt.run(
        titulo !== undefined ? titulo.trim() : actual.titulo,
        fecha || actual.fecha,
        hora_inicio || actual.hora_inicio,
        hora_fin !== undefined ? hora_fin : actual.hora_fin,
        tipo || actual.tipo,
        descripcion !== undefined ? descripcion.trim() : actual.descripcion,
        estado || actual.estado,
        id
      );

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'ACTUALIZAR_CULTO',
        modulo: 'CULTOS',
        detalle: `Culto ID [${id}] actualizado: ${titulo || actual.titulo}`,
        req
      });

      return ok(res, { id }, 'Culto actualizado exitosamente');
    } catch (error) {
      console.error('Error al actualizar culto:', error);
      return fallo(res, 'Error al actualizar el culto', 500);
    }
  },

  /**
   * Eliminar culto
   * DELETE /api/cultos/:id
   */
  eliminar(req, res) {
    try {
      const { id } = req.params;

      const actual = db.prepare('SELECT id, titulo FROM cultos_eventos WHERE id = ?').get(id);
      if (!actual) {
        return fallo(res, 'Culto no encontrado', 404);
      }

      db.prepare('DELETE FROM cultos_eventos WHERE id = ?').run(id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'ELIMINAR_CULTO',
        modulo: 'CULTOS',
        detalle: `Se eliminó el culto ID [${id}] - ${actual.titulo}`,
        req
      });

      return ok(res, null, 'Culto y asignaciones eliminados correctamente');
    } catch (error) {
      console.error('Error al eliminar culto:', error);
      return fallo(res, 'Error al eliminar el culto', 500);
    }
  }
};

module.exports = cultoController;
