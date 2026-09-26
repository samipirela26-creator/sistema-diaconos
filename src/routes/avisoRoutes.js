const express = require('express');
const router = express.Router();
const avisoController = require('../controllers/avisoController');
const { autenticarToken, requiereRol } = require('../middleware/auth');

router.use(autenticarToken);

// Todos los diáconos pueden leer comunicados
router.get('/', avisoController.listar);

// Solo Líder o Root pueden publicar o eliminar avisos
router.post('/', requiereRol('root', 'lider'), avisoController.crear);
router.delete('/:id', requiereRol('root', 'lider'), avisoController.eliminar);

module.exports = router;
