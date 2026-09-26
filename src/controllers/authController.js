const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const { ok, fallo } = require('../helpers/respuesta');
const { generarToken } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/audit');

const authController = {
  /**
   * Inicio de Sesión
   * POST /api/auth/login
   */
  login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return fallo(res, 'Debe proporcionar usuario/correo y contraseña', 400);
      }

      const stmt = db.prepare(`
        SELECT id, username, email, password_hash, nombre_completo, telefono, rol, activo
        FROM usuarios
        WHERE username = ? OR email = ?
      `);
      const usuario = stmt.get(username.trim(), username.trim());

      if (!usuario) {
        registrarAuditoria({
          username,
          accion: 'LOGIN_FALLIDO',
          modulo: 'AUTH',
          detalle: 'Usuario o correo inexistente',
          req
        });
        return fallo(res, 'Credenciales de acceso incorrectas', 401);
      }

      if (!usuario.activo) {
        registrarAuditoria({
          usuarioId: usuario.id,
          username: usuario.username,
          accion: 'LOGIN_BLOQUEADO',
          modulo: 'AUTH',
          detalle: 'Intento de acceso con cuenta desactivada',
          req
        });
        return fallo(res, 'Esta cuenta ha sido desactivada por el administrador', 403);
      }

      const passwordValida = bcrypt.compareSync(password, usuario.password_hash);
      if (!passwordValida) {
        registrarAuditoria({
          usuarioId: usuario.id,
          username: usuario.username,
          accion: 'LOGIN_FALLIDO',
          modulo: 'AUTH',
          detalle: 'Contraseña incorrecta',
          req
        });
        return fallo(res, 'Credenciales de acceso incorrectas', 401);
      }

      const token = generarToken(usuario);

      registrarAuditoria({
        usuarioId: usuario.id,
        username: usuario.username,
        accion: 'LOGIN_EXITOSO',
        modulo: 'AUTH',
        detalle: `Inicio de sesión exitoso con rol [${usuario.rol}]`,
        req
      });

      // No exponer el hash en la respuesta
      const { password_hash, ...datosUsuario } = usuario;

      return ok(res, {
        token,
        usuario: datosUsuario
      }, 'Bienvenido al sistema');
    } catch (error) {
      console.error('Error en login:', error);
      return fallo(res, 'Error interno al procesar el inicio de sesión', 500);
    }
  },

  /**
   * Obtener perfil del usuario autenticado
   * GET /api/auth/me
   */
  me(req, res) {
    return ok(res, req.usuario, 'Datos de perfil cargados');
  },

  /**
   * Cambio de contraseña
   * POST /api/auth/cambiar-password
   */
  cambiarPassword(req, res) {
    try {
      const { password_actual, password_nueva } = req.body;

      if (!password_actual || !password_nueva) {
        return fallo(res, 'Debe proporcionar la contraseña actual y la nueva contraseña', 400);
      }

      if (password_nueva.length < 6) {
        return fallo(res, 'La nueva contraseña debe tener un mínimo de 6 caracteres', 400);
      }

      const stmt = db.prepare('SELECT password_hash FROM usuarios WHERE id = ?');
      const actual = stmt.get(req.usuario.id);

      if (!bcrypt.compareSync(password_actual, actual.password_hash)) {
        return fallo(res, 'La contraseña actual indicada es incorrecta', 400);
      }

      const nuevoHash = bcrypt.hashSync(password_nueva, 10);
      const updateStmt = db.prepare(`
        UPDATE usuarios
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateStmt.run(nuevoHash, req.usuario.id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'CAMBIO_PASSWORD',
        modulo: 'AUTH',
        detalle: 'El usuario actualizó su contraseña',
        req
      });

      return ok(res, null, 'Contraseña actualizada con éxito');
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      return fallo(res, 'Error al actualizar la contraseña', 500);
    }
  }
};

module.exports = authController;
