const db = require('../../config/database');
const { ok, fallo } = require('../helpers/respuesta');
const { registrarAuditoria } = require('../middleware/audit');

const respaldoController = {
  /**
   * Exportar base de datos a formato JSON
   * GET /api/respaldo/exportar
   */
  exportar(req, res) {
    try {
      const puestos = db.prepare('SELECT * FROM puestos_servicio').all();
      const cultos = db.prepare('SELECT * FROM cultos_eventos').all();
      const turnos = db.prepare('SELECT * FROM turnos_asignados').all();
      const reportes = db.prepare('SELECT * FROM reportes_culto').all();
      const avisos = db.prepare('SELECT * FROM avisos').all();
      const disponibilidad = db.prepare('SELECT * FROM disponibilidad').all();
      
      // Usuarios: excluimos passwords por seguridad si no es root
      let usuariosSql = 'SELECT id, username, email, nombre_completo, telefono, rol, activo, created_at FROM usuarios';
      if (req.usuario.rol === 'root') {
        usuariosSql = 'SELECT * FROM usuarios';
      }
      const usuarios = db.prepare(usuariosSql).all();

      const respaldo = {
        app: 'Diáconos App',
        version: 'v105',
        exportedAt: new Date().toISOString(),
        exportedBy: req.usuario.username,
        data: {
          usuarios,
          puestos,
          cultos,
          turnos,
          reportes,
          avisos,
          disponibilidad
        }
      };

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'EXPORTAR_RESPALDO',
        modulo: 'SISTEMA',
        detalle: `Se generó respaldo JSON (${cultos.length} cultos, ${turnos.length} turnos)`,
        req
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="diaconos-respaldo-${new Date().toISOString().split('T')[0]}.json"`);
      return res.send(JSON.stringify(respaldo, null, 2));
    } catch (error) {
      console.error('Error al exportar respaldo:', error);
      return fallo(res, 'Error al generar el archivo de respaldo', 500);
    }
  },

  /**
   * Restaurar base de datos desde un archivo JSON
   * POST /api/respaldo/importar
   */
  importar(req, res) {
    try {
      const backup = req.body;

      if (!backup || !backup.data) {
        return fallo(res, 'Formato de respaldo inválido o corrupto', 400);
      }

      const { puestos, cultos, turnos, reportes, avisos, disponibilidad } = backup.data;

      // Ejecutar restauración dentro de una transacción atómica segura (SSD)
      const restaurarTx = db.transaction(() => {
        db.prepare('PRAGMA defer_foreign_keys = ON;').run();

        if (Array.isArray(puestos)) {
          const insertPuesto = db.prepare(`
            INSERT INTO puestos_servicio (id, nombre, descripcion, cupo_sugerido, orden, activo, created_at)
            VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
            ON CONFLICT(id) DO UPDATE SET
              nombre = excluded.nombre,
              descripcion = excluded.descripcion,
              cupo_sugerido = excluded.cupo_sugerido,
              orden = excluded.orden,
              activo = excluded.activo,
              created_at = excluded.created_at
          `);
          for (const p of puestos) {
            insertPuesto.run(p.id, p.nombre, p.descripcion, p.cupo_sugerido, p.orden, p.activo, p.created_at);
          }
        }

        if (Array.isArray(cultos)) {
          const insertCulto = db.prepare(`
            INSERT INTO cultos_eventos (id, titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, estado, creado_por, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
            ON CONFLICT(id) DO UPDATE SET
              titulo = excluded.titulo,
              fecha = excluded.fecha,
              hora_inicio = excluded.hora_inicio,
              hora_fin = excluded.hora_fin,
              tipo = excluded.tipo,
              descripcion = excluded.descripcion,
              estado = excluded.estado,
              creado_por = excluded.creado_por,
              created_at = excluded.created_at
          `);
          for (const c of cultos) {
            insertCulto.run(c.id, c.titulo, c.fecha, c.hora_inicio, c.hora_fin, c.tipo, c.descripcion, c.estado, c.creado_por, c.created_at);
          }
        }

        if (Array.isArray(turnos)) {
          const insertTurno = db.prepare(`
            INSERT INTO turnos_asignados (id, culto_id, puesto_id, usuario_id, estado_asistencia, motivo_excusa, notas, asignado_por, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
            ON CONFLICT(id) DO UPDATE SET
              culto_id = excluded.culto_id,
              puesto_id = excluded.puesto_id,
              usuario_id = excluded.usuario_id,
              estado_asistencia = excluded.estado_asistencia,
              motivo_excusa = excluded.motivo_excusa,
              notas = excluded.notas,
              asignado_por = excluded.asignado_por,
              updated_at = excluded.updated_at
          `);
          for (const t of turnos) {
            insertTurno.run(t.id, t.culto_id, t.puesto_id, t.usuario_id, t.estado_asistencia, t.motivo_excusa, t.notas, t.asignado_por, t.updated_at);
          }
        }

        if (Array.isArray(reportes)) {
          const insertReporte = db.prepare(`
            INSERT INTO reportes_culto (id, culto_id, registrado_por, asistencia_hermanos, asistencia_ninos, visitas_primeravez, asistencia_total, ofrenda_monto, novedades_incidencias, aprobado_por_lider, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
            ON CONFLICT(id) DO UPDATE SET
              culto_id = excluded.culto_id,
              registrado_por = excluded.registrado_por,
              asistencia_hermanos = excluded.asistencia_hermanos,
              asistencia_ninos = excluded.asistencia_ninos,
              visitas_primeravez = excluded.visitas_primeravez,
              asistencia_total = excluded.asistencia_total,
              ofrenda_monto = excluded.ofrenda_monto,
              novedades_incidencias = excluded.novedades_incidencias,
              aprobado_por_lider = excluded.aprobado_por_lider,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at
          `);
          for (const r of reportes) {
            insertReporte.run(r.id, r.culto_id, r.registrado_por, r.asistencia_hermanos, r.asistencia_ninos, r.visitas_primeravez, r.asistencia_total, r.ofrenda_monto, r.novedades_incidencias, r.aprobado_por_lider, r.created_at, r.updated_at);
          }
        }

        if (Array.isArray(avisos)) {
          const insertAviso = db.prepare(`
            INSERT INTO avisos (id, titulo, contenido, tipo, fijado, creado_por, created_at)
            VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
            ON CONFLICT(id) DO UPDATE SET
              titulo = excluded.titulo,
              contenido = excluded.contenido,
              tipo = excluded.tipo,
              fijado = excluded.fijado,
              creado_por = excluded.creado_por,
              created_at = excluded.created_at
          `);
          for (const a of avisos) {
            insertAviso.run(a.id, a.titulo, a.contenido, a.tipo, a.fijado, a.creado_por, a.created_at);
          }
        }

        if (Array.isArray(disponibilidad)) {
          const insertDisp = db.prepare(`
            INSERT INTO disponibilidad (id, usuario_id, fecha, motivo, created_at)
            VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
            ON CONFLICT(id) DO UPDATE SET
              usuario_id = excluded.usuario_id,
              fecha = excluded.fecha,
              motivo = excluded.motivo,
              created_at = excluded.created_at
          `);
          for (const d of disponibilidad) {
            insertDisp.run(d.id, d.usuario_id, d.fecha, d.motivo, d.created_at);
          }
        }
      });

      restaurarTx();

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'RESTAURAR_RESPALDO',
        modulo: 'SISTEMA',
        detalle: `Se restauró la base de datos desde respaldo exportado el ${backup.exportedAt}`,
        req
      });

      return ok(res, null, 'Respaldo restaurado exitosamente');
    } catch (error) {
      console.error('Error al restaurar respaldo:', error);
      return fallo(res, `Error al restaurar el respaldo: ${error.message}`, 500);
    }
  }
};

module.exports = respaldoController;
