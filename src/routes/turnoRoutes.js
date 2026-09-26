const express = require('express');
const router = express.Router();
const turnoController = require('../controllers/turnoController');
const { autenticarToken, requiereRol } = require('../middleware/auth');

router.use(autenticarToken);

// Ver mis asignaciones de servicio
router.get('/mis-turnos', turnoController.misTurnos);

// Asignar diácono a un puesto en un culto (Líder o Root)
router.post('/asignar', requiereRol('root', 'lider'), turnoController.asignar);

// Eliminar asignación (Líder o Root)
router.delete('/:id', requiereRol('root', 'lider'), turnoController.eliminar);

// Confirmar o excusarse de un turno asignado (Diácono)
router.post('/:id/responder', turnoController.responder);

// Registrar asistencia real cumplida tras el servicio (Líder o Root)
router.patch('/:id/asistencia', requiereRol('root', 'lider'), turnoController.marcarAsistenciaReal);

module.exports = router;
