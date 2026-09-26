const db = require('../../config/database');
const { ok, fallo } = require('../helpers/respuesta');
const { registrarAuditoria } = require('../middleware/audit');

const turnoController = {
  /**
   * Asignar un diácono a un puesto en un culto
   * POST /api/turnos/asignar
   */
  asignar(req, res) {
    try {
      const { culto_id, puesto_id, usuario_id, notas } = req.body;

      if (!culto_id || !puesto_id || !usuario_id) {
        return fallo(res, 'Culto, puesto y diácono son obligatorios', 400);
      }

      // Validar existencia de culto
      const culto = db.prepare('SELECT id, titulo, fecha FROM cultos_eventos WHERE id = ?').get(culto_id);
      if (!culto) {
        return fallo(res, 'El culto seleccionado no existe', 404);
      }

      // Validar puesto
      const puesto = db.prepare('SELECT id, nombre, cupo_sugerido FROM puestos_servicio WHERE id = ? AND activo = 1').get(puesto_id);
      if (!puesto) {
        return fallo(res, 'El puesto de servicio no existe o está inactivo', 404);
      }

      // Validar usuario
      const usuario = db.prepare('SELECT id, nombre_completo, activo FROM usuarios WHERE id = ?').get(usuario_id);
      if (!usuario) {
        return fallo(res, 'El diácono no existe', 404);
      }
      if (!usuario.activo) {
        return fallo(res, 'No se puede asignar un turno a un usuario inactivo', 400);
      }

      // Validar si el diácono registró indisponibilidad en la fecha del culto
      const indisponible = db.prepare('SELECT motivo FROM disponibilidad WHERE usuario_id = ? AND fecha = ?').get(usuario_id, culto.fecha);
      if (indisponible) {
        return fallo(
          res,
          `El diácono [${usuario.nombre_completo}] reportó que NO está disponible el [${culto.fecha}]. Motivo: "${indisponible.motivo}"`,
          400
        );
      }

      // Comprobar si ya está asignado a ese mismo culto (en cualquier puesto)
      const asignacionExistente = db.prepare(`
        SELECT t.id, p.nombre as puesto_nombre
        FROM turnos_asignados t
        JOIN puestos_servicio p ON t.puesto_id = p.id
        WHERE t.culto_id = ? AND t.usuario_id = ?
      `).get(culto_id, usuario_id);

      if (asignacionExistente) {
        return fallo(
          res,
          `El diácono [${usuario.nombre_completo}] ya tiene una asignación en este culto en el puesto [${asignacionExistente.puesto_nombre}]`,
          400
        );
      }

      const stmt = db.prepare(`
        INSERT INTO turnos_asignados (culto_id, puesto_id, usuario_id, estado_asistencia, notas, asignado_por)
        VALUES (?, ?, ?, 'pendiente', ?, ?)
      `);

      const resultado = stmt.run(culto_id, puesto_id, usuario_id, notas ? notas.trim() : null, req.usuario.id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'ASIGNAR_TURNO',
        modulo: 'TURNOS',
        detalle: `Asignado [${usuario.nombre_completo}] a [${puesto.nombre}] en el culto [${culto.titulo} - ${culto.fecha}]`,
        req
      });

      return ok(
        res,
        { id: resultado.lastInsertRowid, culto_id, puesto_id, usuario_id },
        'Diácono asignado exitosamente',
        201
      );
    } catch (error) {
      console.error('Error al asignar turno:', error);
      return fallo(res, 'Error al asignar el turno', 500);
    }
  },

  /**
   * Eliminar asignación de turno
   * DELETE /api/turnos/:id
   */
  eliminar(req, res) {
    try {
      const { id } = req.params;

      const turno = db.prepare(`
        SELECT t.id, u.nombre_completo, p.nombre as puesto, c.titulo, c.fecha
        FROM turnos_asignados t
        JOIN usuarios u ON t.usuario_id = u.id
        JOIN puestos_servicio p ON t.puesto_id = p.id
        JOIN cultos_eventos c ON t.culto_id = c.id
        WHERE t.id = ?
      `).get(id);

      if (!turno) {
        return fallo(res, 'Asignación de turno no encontrada', 404);
      }

      db.prepare('DELETE FROM turnos_asignados WHERE id = ?').run(id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'DESASIGNAR_TURNO',
        modulo: 'TURNOS',
        detalle: `Se removió a [${turno.nombre_completo}] de [${turno.puesto}] en [${turno.titulo}]`,
        req
      });

      return ok(res, null, 'Asignación removida con éxito');
    } catch (error) {
      console.error('Error al desasignar turno:', error);
      return fallo(res, 'Error al remover la asignación', 500);
    }
  },

  /**
   * Obtener los turnos asignados del usuario autenticado (Mi Agenda)
   * GET /api/turnos/mis-turnos
   */
  misTurnos(req, res) {
    try {
      const stmt = db.prepare(`
        SELECT 
          t.id as turno_id, t.estado_asistencia, t.motivo_excusa, t.notas,
          c.id as culto_id, c.titulo as culto_titulo, c.fecha as culto_fecha,
          c.hora_inicio, c.hora_fin, c.tipo, c.estado as culto_estado,
          p.nombre as puesto_nombre, p.descripcion as puesto_descripcion
        FROM turnos_asignados t
        JOIN cultos_eventos c ON t.culto_id = c.id
        JOIN puestos_servicio p ON t.puesto_id = p.id
        WHERE t.usuario_id = ?
        ORDER BY c.fecha DESC, c.hora_inicio ASC
      `);

      const turnos = stmt.all(req.usuario.id);
      return ok(res, turnos, 'Tus asignaciones de servicio');
    } catch (error) {
      console.error('Error al obtener mis turnos:', error);
      return fallo(res, 'Error al consultar tus turnos', 500);
    }
  },

  /**
   * Responder a una asignación (Confirmar o Excusarse)
   * POST /api/turnos/:id/responder
   */
  responder(req, res) {
    try {
      const { id } = req.params;
      const { estado_asistencia, motivo_excusa } = req.body;

      if (!['confirmado', 'excusado'].includes(estado_asistencia)) {
        return fallo(res, "El estado debe ser 'confirmado' o 'excusado'", 400);
      }

      if (estado_asistencia === 'excusado' && (!motivo_excusa || !motivo_excusa.trim())) {
        return fallo(res, 'Debe indicar un motivo si no podrá asistir al turno asignado', 400);
      }

      const turno = db.prepare(`
        SELECT t.*, u.nombre_completo, c.titulo as culto_titulo
        FROM turnos_asignados t
        JOIN usuarios u ON t.usuario_id = u.id
        JOIN cultos_eventos c ON t.culto_id = c.id
        WHERE t.id = ?
      `).get(id);

      if (!turno) {
        return fallo(res, 'Turno no encontrado', 404);
      }

      // RBAC: Solo el propio diácono asignado, o un líder/root pueden confirmar/excusar
      if (req.usuario.rol === 'diacono' && turno.usuario_id !== req.usuario.id) {
        return fallo(res, 'No puedes modificar la confirmación de otro diácono', 403);
      }

      const stmt = db.prepare(`
        UPDATE turnos_asignados
        SET estado_asistencia = ?, motivo_excusa = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        estado_asistencia,
        estado_asistencia === 'excusado' ? motivo_excusa.trim() : null,
        id
      );

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'RESPUESTA_TURNO',
        modulo: 'TURNOS',
        detalle: `Turno ID [${id}] marcado como [${estado_asistencia}] para [${turno.nombre_completo}] en [${turno.culto_titulo}]`,
        req
      });

      return ok(
        res,
        { id, estado_asistencia, motivo_excusa },
        estado_asistencia === 'confirmado' ? 'Asistencia confirmada con éxito' : 'Excusa registrada correctamente'
      );
    } catch (error) {
      console.error('Error al responder turno:', error);
      return fallo(res, 'Error al actualizar tu confirmación', 500);
    }
  },

  /**
   * Pasar asistencia real después del servicio (Líder / Root)
   * PATCH /api/turnos/:id/asistencia
   */
  marcarAsistenciaReal(req, res) {
    try {
      const { id } = req.params;
      const { estado_asistencia } = req.body;

      if (!['asistio', 'inasistencia'].includes(estado_asistencia)) {
        return fallo(res, "El estado real debe ser 'asistio' o 'inasistencia'", 400);
      }

      const turno = db.prepare('SELECT id FROM turnos_asignados WHERE id = ?').get(id);
      if (!turno) {
        return fallo(res, 'Turno no encontrado', 404);
      }

      db.prepare(`
        UPDATE turnos_asignados
        SET estado_asistencia = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(estado_asistencia, id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'REGISTRO_ASISTENCIA_REAL',
        modulo: 'TURNOS',
        detalle: `Turno ID [${id}] marcado como [${estado_asistencia}]`,
        req
      });

      return ok(res, { id, estado_asistencia }, 'Asistencia registrada');
    } catch (error) {
      console.error('Error al marcar asistencia real:', error);
      return fallo(res, 'Error al registrar la asistencia', 500);
    }
  }
};

module.exports = turnoController;
