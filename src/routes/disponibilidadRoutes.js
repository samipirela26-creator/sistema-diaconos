const express = require('express');
const router = express.Router();
const disponibilidadController = require('../controllers/disponibilidadController');
const { autenticarToken } = require('../middleware/auth');

router.use(autenticarToken);

router.get('/', disponibilidadController.listar);
router.post('/', disponibilidadController.registrar);
router.delete('/:id', disponibilidadController.eliminar);

module.exports = router;
