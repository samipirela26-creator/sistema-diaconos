const express = require('express');
const router = express.Router();
const auditoriaController = require('../controllers/auditoriaController');
const { autenticarToken, requiereRol } = require('../middleware/auth');

router.use(autenticarToken);

// Solo Root y Líder de Diáconos pueden inspeccionar la bitácora de auditoría
router.get('/', requiereRol('root', 'lider'), auditoriaController.listar);

module.exports = router;
