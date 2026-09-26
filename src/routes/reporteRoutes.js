const express = require('express');
const router = express.Router();
const reporteController = require('../controllers/reporteController');
const { autenticarToken, requiereRol } = require('../middleware/auth');

router.use(autenticarToken);

// Consultar reporte de un culto
router.get('/culto/:cultoId', reporteController.obtenerPorCulto);

// Guardar o actualizar reporte
router.post('/', reporteController.guardar);

// Estadísticas generales y métricas de asistencia (Líder o Root)
router.get('/estadisticas', requiereRol('root', 'lider'), reporteController.estadisticas);

module.exports = router;
