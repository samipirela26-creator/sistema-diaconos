const jwt = require('jsonwebtoken');
const db = require('../../config/database');
const { fallo } = require('../helpers/respuesta');

const JWT_SECRET = process.env.JWT_SECRET || 'clave-secreta-diaconos-ssd-segura-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Genera un token JWT para la sesión del usuario
 */
function generarToken(usuario) {
  const payload = {
    id: usuario.id,
    username: usuario.username,
    rol: usuario.rol,
    nombre_completo: usuario.nombre_completo
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Middleware de Autenticación
 * Extrae y valida el JWT desde encabezado Authorization o Cookies
 */
function autenticarToken(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return fallo(res, 'Acceso denegado: Token de autenticación no proporcionado', 401);
  }

  try {
    const decodificado = jwt.verify(token, JWT_SECRET);

    // Verificación en BD para asegurar que el usuario existe y sigue activo
    const stmt = db.prepare('SELECT id, username, email, nombre_completo, rol, activo FROM usuarios WHERE id = ?');
    const usuarioBD = stmt.get(decodificado.id);

    if (!usuarioBD) {
      return fallo(res, 'Sesión inválida: El usuario ya no existe en el sistema', 401);
    }

    if (!usuarioBD.activo) {
      return fallo(res, 'Acceso denegado: Esta cuenta se encuentra inactiva o suspendida', 403);
    }

    // Fijar usuario verificado en la petición
    req.usuario = usuarioBD;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return fallo(res, 'Tu sesión ha expirado. Por favor inicia sesión nuevamente', 401);
    }
    return fallo(res, 'Token de autenticación inválido o manipulado', 401);
  }
}

/**
 * Middleware RBAC (Control de acceso basado en roles)
 * @param  {...string} rolesPermitidos - Lista de roles permitidos ('root', 'lider', 'diacono')
 */
function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return fallo(res, 'No autenticado', 401);
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return fallo(
        res,
        `Acceso restringido: Se requiere rol [${rolesPermitidos.join(', ')}]. Tu rol actual es [${req.usuario.rol}]`,
        403
      );
    }

    next();
  };
}

module.exports = {
  generarToken,
  autenticarToken,
  requiereRol,
  JWT_SECRET
};
