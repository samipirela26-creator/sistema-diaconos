const db = require('../../config/database');
const { ok, fallo } = require('../helpers/respuesta');
const { registrarAuditoria } = require('../middleware/audit');

const puestoController = {
  /**
   * Listar todos los puestos de servicio
   * GET /api/puestos
   */
  listar(req, res) {
    try {
      const stmt = db.prepare(`
        SELECT id, nombre, descripcion, cupo_sugerido, orden, activo
        FROM puestos_servicio
        ORDER BY orden ASC, nombre ASC
      `);
      return ok(res, stmt.all(), 'Listado de puestos de servicio');
    } catch (error) {
      console.error('Error al listar puestos:', error);
      return fallo(res, 'Error al obtener los puestos de servicio', 500);
    }
  },

  /**
   * Crear nuevo puesto de servicio
   * POST /api/puestos
   */
  crear(req, res) {
    try {
      const { nombre, descripcion, cupo_sugerido = 1, orden = 0 } = req.body;

      if (!nombre || !nombre.trim()) {
        return fallo(res, 'El nombre del puesto es obligatorio', 400);
      }

      const existe = db.prepare('SELECT id FROM puestos_servicio WHERE nombre = ?').get(nombre.trim());
      if (existe) {
        return fallo(res, 'Ya existe un puesto con ese nombre', 400);
      }

      const stmt = db.prepare(`
        INSERT INTO puestos_servicio (nombre, descripcion, cupo_sugerido, orden, activo)
        VALUES (?, ?, ?, ?, 1)
      `);

      const resultado = stmt.run(nombre.trim(), descripcion ? descripcion.trim() : '', Number(cupo_sugerido) || 1, Number(orden) || 0);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'CREAR_PUESTO',
        modulo: 'PUESTOS',
        detalle: `Se creó el puesto [${nombre}] con cupo [${cupo_sugerido}]`,
        req
      });

      return ok(res, { id: resultado.lastInsertRowid, nombre: nombre.trim() }, 'Puesto creado con éxito', 201);
    } catch (error) {
      console.error('Error al crear puesto:', error);
      return fallo(res, 'Error al registrar el puesto', 500);
    }
  },

  /**
   * Actualizar puesto
   * PUT /api/puestos/:id
   */
  actualizar(req, res) {
    try {
      const { id } = req.params;
      const { nombre, descripcion, cupo_sugerido, orden, activo } = req.body;

      const puestoActual = db.prepare('SELECT * FROM puestos_servicio WHERE id = ?').get(id);
      if (!puestoActual) {
        return fallo(res, 'Puesto no encontrado', 404);
      }

      const nuevoNombre = nombre ? nombre.trim() : puestoActual.nombre;
      const nuevaDesc = descripcion !== undefined ? descripcion.trim() : puestoActual.descripcion;
      const nuevoCupo = cupo_sugerido !== undefined ? Number(cupo_sugerido) : puestoActual.cupo_sugerido;
      const nuevoOrden = orden !== undefined ? Number(orden) : puestoActual.orden;
      const nuevoActivo = activo !== undefined ? (Number(activo) ? 1 : 0) : puestoActual.activo;

      const stmt = db.prepare(`
        UPDATE puestos_servicio
        SET nombre = ?, descripcion = ?, cupo_sugerido = ?, orden = ?, activo = ?
        WHERE id = ?
      `);
      stmt.run(nuevoNombre, nuevaDesc, nuevoCupo, nuevoOrden, nuevoActivo, id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'ACTUALIZAR_PUESTO',
        modulo: 'PUESTOS',
        detalle: `Puesto ID [${id}] actualizado`,
        req
      });

      return ok(res, { id, nombre: nuevoNombre }, 'Puesto actualizado correctamente');
    } catch (error) {
      console.error('Error al actualizar puesto:', error);
      return fallo(res, 'Error al actualizar el puesto', 500);
    }
  },

  /**
   * Eliminar puesto (si no tiene turnos históricos)
   * DELETE /api/puestos/:id
   */
  eliminar(req, res) {
    try {
      const { id } = req.params;

      const turnosAsociados = db.prepare('SELECT COUNT(*) as total FROM turnos_asignados WHERE puesto_id = ?').get(id);
      if (turnosAsociados.total > 0) {
        // En SSD no eliminamos físicamente registros con historial, se desactiva
        db.prepare('UPDATE puestos_servicio SET activo = 0 WHERE id = ?').run(id);
        return ok(res, { id, activo: 0 }, 'El puesto tiene turnos asociados; se ha desactivado para proteger el historial');
      }

      db.prepare('DELETE FROM puestos_servicio WHERE id = ?').run(id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'ELIMINAR_PUESTO',
        modulo: 'PUESTOS',
        detalle: `Puesto ID [${id}] eliminado`,
        req
      });

      return ok(res, null, 'Puesto eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar puesto:', error);
      return fallo(res, 'Error al eliminar el puesto', 500);
    }
  }
};

module.exports = puestoController;
