const express = require('express');
const router = express.Router();
const puestoController = require('../controllers/puestoController');
const { autenticarToken, requiereRol } = require('../middleware/auth');

router.use(autenticarToken);

router.get('/', puestoController.listar);
router.post('/', requiereRol('root', 'lider'), puestoController.crear);
router.put('/:id', requiereRol('root', 'lider'), puestoController.actualizar);
router.delete('/:id', requiereRol('root', 'lider'), puestoController.eliminar);

module.exports = router;
