const express = require('express');
const router = express.Router();
const respaldoController = require('../controllers/respaldoController');
const { autenticarToken, requiereRol } = require('../middleware/auth');

router.use(autenticarToken);

// Exportar respaldo (Root o Líder)
router.get('/exportar', requiereRol('root', 'lider'), respaldoController.exportar);

// Restaurar respaldo (Solo Root por seguridad SSD)
router.post('/importar', requiereRol('root'), respaldoController.importar);

module.exports = router;
