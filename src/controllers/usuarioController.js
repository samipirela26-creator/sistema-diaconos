const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const { ok, fallo } = require('../helpers/respuesta');
const { registrarAuditoria } = require('../middleware/audit');

const usuarioController = {
  /**
   * Listar usuarios según permisos RBAC
   * GET /api/usuarios
   */
  listar(req, res) {
    try {
      const { rol } = req.usuario;

      if (rol === 'root') {
        const stmt = db.prepare(`
          SELECT id, username, email, nombre_completo, telefono, rol, activo, created_at
          FROM usuarios
          ORDER BY id DESC
        `);
        return ok(res, stmt.all(), 'Listado completo de usuarios');
      }

      if (rol === 'lider') {
        const stmt = db.prepare(`
          SELECT id, username, email, nombre_completo, telefono, rol, activo, created_at
          FROM usuarios
          WHERE rol IN ('diacono', 'lider')
          ORDER BY rol ASC, nombre_completo ASC
        `);
        return ok(res, stmt.all(), 'Listado de equipo de diáconos');
      }

      // Rol diácono: Directorio de contactos de servidores activos
      const stmt = db.prepare(`
        SELECT id, nombre_completo, telefono, rol
        FROM usuarios
        WHERE activo = 1
        ORDER BY nombre_completo ASC
      `);
      return ok(res, stmt.all(), 'Directorio de diáconos');
    } catch (error) {
      console.error('Error al listar usuarios:', error);
      return fallo(res, 'Error al obtener la lista de usuarios', 500);
    }
  },

  /**
   * Obtener un usuario por ID
   * GET /api/usuarios/:id
   */
  obtenerPorId(req, res) {
    try {
      const { id } = req.params;
      const stmt = db.prepare(`
        SELECT id, username, email, nombre_completo, telefono, rol, activo, created_at
        FROM usuarios
        WHERE id = ?
      `);
      const usuario = stmt.get(id);

      if (!usuario) {
        return fallo(res, 'Usuario no encontrado', 404);
      }

      // Restricción RBAC: Líder no puede ver detalles de Root
      if (req.usuario.rol === 'lider' && usuario.rol === 'root') {
        return fallo(res, 'No tienes autorización para consultar este perfil', 403);
      }

      return ok(res, usuario, 'Usuario encontrado');
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      return fallo(res, 'Error al consultar el usuario', 500);
    }
  },

  /**
   * Registrar nuevo usuario
   * POST /api/usuarios
   */
  crear(req, res) {
    try {
      const { username, password, email, nombre_completo, telefono, rol = 'diacono' } = req.body;

      if (!username || !password || !nombre_completo) {
        return fallo(res, 'Nombre de usuario, contraseña y nombre completo son requeridos', 400);
      }

      const rolSolicitado = rol.toLowerCase();
      if (!['root', 'lider', 'diacono'].includes(rolSolicitado)) {
        return fallo(res, 'Rol no válido. Permitidos: root, lider, diacono', 400);
      }

      // Validación RBAC estricta (SSD):
      // - Líder de Diáconos solo puede crear usuarios con rol 'diacono'
      // - Solo Root puede crear 'lider' o 'root'
      if (req.usuario.rol === 'lider' && rolSolicitado !== 'diacono') {
        return fallo(res, 'Como líder solo puedes registrar cuentas de Diáconos', 403);
      }

      // Comprobar existencia previa de username
      const existeUser = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(username.trim());
      if (existeUser) {
        return fallo(res, 'El nombre de usuario ya está registrado en el sistema', 400);
      }

      // Comprobar existencia previa de email si fue provisto
      if (email && email.trim()) {
        const existeEmail = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.trim());
        if (existeEmail) {
          return fallo(res, 'El correo electrónico ya se encuentra registrado', 400);
        }
      }

      const hash = bcrypt.hashSync(password, 10);

      const stmt = db.prepare(`
        INSERT INTO usuarios (username, email, password_hash, nombre_completo, telefono, rol, activo)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `);

      const resultado = stmt.run(
        username.trim(),
        email ? email.trim() : null,
        hash,
        nombre_completo.trim(),
        telefono ? telefono.trim() : null,
        rolSolicitado
      );

      const nuevoId = resultado.lastInsertRowid;

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'CREAR_USUARIO',
        modulo: 'USUARIOS',
        detalle: `Se creó el usuario [${username}] con rol [${rolSolicitado}]`,
        req
      });

      return ok(
        res,
        { id: nuevoId, username: username.trim(), nombre_completo: nombre_completo.trim(), rol: rolSolicitado },
        'Usuario registrado exitosamente',
        201
      );
    } catch (error) {
      console.error('Error al crear usuario:', error);
      return fallo(res, 'Error al registrar el usuario', 500);
    }
  },

  /**
   * Actualizar usuario
   * PUT /api/usuarios/:id
   */
  actualizar(req, res) {
    try {
      const { id } = req.params;
      const { nombre_completo, telefono, email, rol, activo, password } = req.body;

      const usuarioActual = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
      if (!usuarioActual) {
        return fallo(res, 'Usuario no encontrado', 404);
      }

      // RBAC: Líder no puede modificar a Root ni a otro Líder
      if (req.usuario.rol === 'lider' && (usuarioActual.rol === 'root' || usuarioActual.rol === 'lider')) {
        return fallo(res, 'No tienes permisos para modificar este usuario', 403);
      }

      // RBAC: Líder no puede promover a un diácono a Root o Líder
      if (req.usuario.rol === 'lider' && rol && rol !== 'diacono') {
        return fallo(res, 'No tienes autorización para cambiar el rol a Líder o Root', 403);
      }

      // Evitar que el último Root se desactive o cambie de rol
      if (usuarioActual.rol === 'root' && (activo === 0 || (rol && rol !== 'root'))) {
        const totalRoots = db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'root' AND activo = 1").get();
        if (totalRoots.total <= 1) {
          return fallo(res, 'No se puede desactivar ni degradar al único usuario Root del sistema', 400);
        }
      }

      let passwordHash = usuarioActual.password_hash;
      if (password && password.trim().length >= 6) {
        passwordHash = bcrypt.hashSync(password.trim(), 10);
      }

      const nuevoNombre = nombre_completo ? nombre_completo.trim() : usuarioActual.nombre_completo;
      const nuevoTelefono = telefono !== undefined ? (telefono ? telefono.trim() : null) : usuarioActual.telefono;
      const nuevoEmail = email !== undefined ? (email ? email.trim() : null) : usuarioActual.email;
      const nuevoRol = rol || usuarioActual.rol;
      const nuevoActivo = activo !== undefined ? (Number(activo) ? 1 : 0) : usuarioActual.activo;

      const updateStmt = db.prepare(`
        UPDATE usuarios
        SET nombre_completo = ?, telefono = ?, email = ?, rol = ?, activo = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      updateStmt.run(nuevoNombre, nuevoTelefono, nuevoEmail, nuevoRol, nuevoActivo, passwordHash, id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: 'ACTUALIZAR_USUARIO',
        modulo: 'USUARIOS',
        detalle: `Se actualizó el usuario ID [${id}] - ${nuevoNombre}`,
        req
      });

      return ok(res, { id, nombre_completo: nuevoNombre, rol: nuevoRol, activo: nuevoActivo }, 'Usuario actualizado');
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      return fallo(res, 'Error al actualizar datos del usuario', 500);
    }
  },

  /**
   * Cambiar estado activo/inactivo (Soft delete)
   * PATCH /api/usuarios/:id/toggle-activo
   */
  toggleActivo(req, res) {
    try {
      const { id } = req.params;
      const target = db.prepare('SELECT id, username, rol, activo FROM usuarios WHERE id = ?').get(id);

      if (!target) {
        return fallo(res, 'Usuario no encontrado', 404);
      }

      if (req.usuario.rol === 'lider' && target.rol !== 'diacono') {
        return fallo(res, 'Solo puedes desactivar cuentas de Diáconos', 403);
      }

      if (target.rol === 'root' && target.activo === 1) {
        return fallo(res, 'No es posible desactivar una cuenta con rol Root', 400);
      }

      const nuevoEstado = target.activo === 1 ? 0 : 1;
      db.prepare('UPDATE usuarios SET activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nuevoEstado, id);

      registrarAuditoria({
        usuarioId: req.usuario.id,
        username: req.usuario.username,
        accion: nuevoEstado === 1 ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO',
        modulo: 'USUARIOS',
        detalle: `Se cambió el estado del usuario [${target.username}] a [${nuevoEstado ? 'Activo' : 'Inactivo'}]`,
        req
      });

      return ok(res, { id, activo: nuevoEstado }, `Usuario ${nuevoEstado ? 'activado' : 'desactivado'}`);
    } catch (error) {
      console.error('Error al alternar estado de usuario:', error);
      return fallo(res, 'Error al cambiar estado del usuario', 500);
    }
  }
};

module.exports = usuarioController;
