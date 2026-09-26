const rateLimit = require('express-rate-limit');
const { fallo } = require('../helpers/respuesta');

/**
 * Limitador estricto para rutas de autenticación (Login)
 * Mitiga ataques de fuerza bruta y ataques por diccionario (SSD)
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 intentos por IP en esa ventana
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return fallo(
      res,
      'Demasiados intentos de inicio de sesión. Por motivos de seguridad, tu acceso temporal ha sido bloqueado por 15 minutos.',
      429
    );
  }
});

/**
 * Limitador general para el resto de la API
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 120, // 120 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return fallo(res, 'Has superado el límite de solicitudes. Espera un momento antes de reintentar.', 429);
  }
});

module.exports = {
  loginLimiter,
  apiLimiter
};
