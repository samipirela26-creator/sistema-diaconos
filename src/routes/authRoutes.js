const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { autenticarToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

// Iniciar sesión con protección de rate limiting
router.post('/login', loginLimiter, authController.login);

// Obtener perfil actual
router.get('/me', autenticarToken, authController.me);

// Cambiar contraseña propia
router.post('/cambiar-password', autenticarToken, authController.cambiarPassword);

module.exports = router;
