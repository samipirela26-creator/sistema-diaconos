const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { autenticarToken, requiereRol } = require('../middleware/auth');

router.use(autenticarToken);

// Listar usuarios (diácono ve directorio; líder ve equipo; root ve todos)
router.get('/', usuarioController.listar);

// Detalle de usuario
router.get('/:id', requiereRol('root', 'lider'), usuarioController.obtenerPorId);

// Registrar usuario (Root o Líder)
router.post('/', requiereRol('root', 'lider'), usuarioController.crear);

// Modificar usuario
router.put('/:id', requiereRol('root', 'lider'), usuarioController.actualizar);

// Activar/Desactivar usuario
router.patch('/:id/toggle-activo', requiereRol('root', 'lider'), usuarioController.toggleActivo);

module.exports = router;
