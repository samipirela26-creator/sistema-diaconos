const db = require('../../config/database');
const { ok, fallo } = require('../helpers/respuesta');
const { registrarAuditoria } = require('../middleware/audit');

const reporteController = {
  /**
   * Obtener reporte de un culto específico
   * GET /api/reportes/culto/:cultoId
   */
  obtenerPorCulto(req, res) {
    try {
      const { cultoId } = req.params;

      const stmt = db.prepare(`
        SELECT 
          r.*, 
          u.nombre_completo as registrado_por_nombre,
          c.titulo as culto_titulo, c.fecha as culto_fecha, c.hora_inicio
        FROM reportes_culto r
        JOIN cultos_eventos c ON r.culto_id = c.id
        LEFT JOIN usuarios u ON r.registrado_por = u.id
        WHERE r.culto_id = ?
      `);

      const reporte = stmt.get(cultoId);
      if (!reporte) {
        return ok(res, null, 'No hay reporte registrado para este culto aún');
      }

      return ok(res, reporte, 'Reporte de culto obtenido');
    } catch (error) {
      console.error('Error al obtener reporte:', error);
      return fallo(res, 'Error al consultar el reporte de culto', 500);
    }
  },

  /**
   * Registrar o actualizar reporte de culto
   * POST /api/reportes
   */
  guardar(req, res) {
    try {
      const {
        culto_id,
        asistencia_hermanos = 0,
        asistencia_ninos = 0,
        visitas_primeravez = 0,
        ofrenda_monto = 0.0,
        novedades_incidencias = '',
        aprobado_por_lider = 0
      } = req.body;

      if (!culto_id) {
        return fallo(res, 'Debe especificar el culto correspondiente', 400);
      }

      const culto = db.prepare('SELECT id, titulo, fecha FROM cultos_eventos WHERE id = ?').get(culto_id);
      if (!culto) {
        return fallo(res, 'El culto indicado no existe', 404);
      }

      // RBAC: Si es un diácono, debe estar asignado a ese culto para reportar
      if (req.usuario.rol === 'diacono') {
        const asignado = db.prepare('SELECT id FROM turnos_asignados WHERE culto_id = ? AND usuario_id = ?').get(culto_id, req.usuario.id);
        if (!asignado) {
          return fallo(res, 'Solo diáconos asignados a este culto (o líderes) pueden registrar el reporte', 403);
        }
      }

      const h = Math.max(0, parseInt(asistencia_hermanos) || 0);
      const n = Math.max(0, parseInt(asistencia_ninos) || 0);
      const v = Math.max(0, parseInt(visitas_primeravez) || 0);
      const total = h + n + v;
      const ofrenda = Math.max(0, parseFloat(ofrenda_monto) || 0.0);
      const aprobado = (req.usuario.rol === 'root' || req.usuario.rol === 'lider') ? (aprobado_por_lider ? 1 : 0) : 0;

      // Upsert: Si ya existe se actualiza, si no, se crea
      const existente = db.prepare('SELECT id FROM reportes_culto WHERE culto_id = ?').get(culto_id);

      if (existente) {
        const updateStmt = db.prepare(`
          UPDATE reportes_culto
          SET 
            asistencia_hermanos = ?,
            asistencia_ninos = ?,
            visitas_primeravez = ?,
            asistencia_total = ?,
            ofrenda_monto = ?,
            novedades_incidencias = ?,
            aprobado_por_lider = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        updateStmt.run(h, n, v, total, ofrenda, novedades_incidencias ? novedades_incidencias.trim() : '', aprobado, existente.id);

        registrarAuditoria({
          usuarioId: req.usuario.id,
          username: req.usuario.username,
          accion: 'ACTUALIZAR_REPORTE',
          modulo: 'REPORTES',
          detalle: `Reporte actualizado para [${culto.titulo}] - Total: ${total}`,
          req
        });

        return ok(res, { id: existente.id, asistencia_total: total }, 'Reporte de culto actualizado');
      } else {
        const insertStmt = db.prepare(`
          INSERT INTO reportes_culto (
            culto_id, registrado_por, asistencia_hermanos, asistencia_ninos,
            visitas_primeravez, asistencia_total, ofrenda_monto, novedades_incidencias, aprobado_por_lider
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const resultado = insertStmt.run(
          culto_id,
          req.usuario.id,
          h,
          n,
          v,
          total,
          ofrenda,
          novedades_incidencias ? novedades_incidencias.trim() : '',
          aprobado
        );

        registrarAuditoria({
          usuarioId: req.usuario.id,
          username: req.usuario.username,
          accion: 'CREAR_REPORTE',
          modulo: 'REPORTES',
          detalle: `Reporte creado para [${culto.titulo}]. Total asistentes: ${total}`,
          req
        });

        return ok(res, { id: resultado.lastInsertRowid, asistencia_total: total }, 'Reporte guardado con éxito', 201);
      }
    } catch (error) {
      console.error('Error al guardar reporte:', error);
      return fallo(res, 'Error al guardar el reporte de culto', 500);
    }
  },

  /**
   * Resumen y estadísticas para el panel general
   * GET /api/reportes/estadisticas
   */
  estadisticas(req, res) {
    try {
      // Totales y promedios de los últimos cultos
      const stats = db.prepare(`
        SELECT 
          COUNT(r.id) as total_reportes,
          COALESCE(SUM(r.asistencia_total), 0) as asistencia_acumulada,
          COALESCE(ROUND(AVG(r.asistencia_total), 1), 0) as promedio_asistencia,
          COALESCE(SUM(r.visitas_primeravez), 0) as total_visitas,
          COALESCE(SUM(r.ofrenda_monto), 0) as total_ofrendas
        FROM reportes_culto r
      `).get();

      // Últimos 5 reportes
      const ultimos = db.prepare(`
        SELECT 
          r.id, r.asistencia_total, r.visitas_primeravez, r.novedades_incidencias, r.created_at,
          c.titulo as culto_titulo, c.fecha as culto_fecha
        FROM reportes_culto r
        JOIN cultos_eventos c ON r.culto_id = c.id
        ORDER BY c.fecha DESC
        LIMIT 5
      `).all();

      return ok(res, { stats, ultimos }, 'Estadísticas generales de cultos');
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return fallo(res, 'Error al calcular estadísticas', 500);
    }
  }
};

module.exports = reporteController;
