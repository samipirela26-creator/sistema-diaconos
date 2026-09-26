const express = require('express');
const router = express.Router();
const cultoController = require('../controllers/cultoController');
const { autenticarToken, requiereRol } = require('../middleware/auth');

router.use(autenticarToken);

router.get('/', cultoController.listar);
router.get('/:id', cultoController.obtenerPorId);
router.post('/', requiereRol('root', 'lider'), cultoController.crear);
router.put('/:id', requiereRol('root', 'lider'), cultoController.actualizar);
router.delete('/:id', requiereRol('root', 'lider'), cultoController.eliminar);

module.exports = router;
