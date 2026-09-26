require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const db = require('./config/database');

const authRoutes = require('./src/routes/authRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes');
const puestoRoutes = require('./src/routes/puestoRoutes');
const cultoRoutes = require('./src/routes/cultoRoutes');
const turnoRoutes = require('./src/routes/turnoRoutes');
const reporteRoutes = require('./src/routes/reporteRoutes');
const auditoriaRoutes = require('./src/routes/auditoriaRoutes');
const avisoRoutes = require('./src/routes/avisoRoutes');
const disponibilidadRoutes = require('./src/routes/disponibilidadRoutes');
const { fallo, ok } = require('./src/helpers/respuesta');
const { apiLimiter } = require('./src/middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de middlewares base
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting para APIs
app.use('/api', apiLimiter);

// Monitoreo y estado del servidor
app.get('/api/salud', (req, res) => {
  return ok(res, {
    estado: 'activo',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  }, 'Servidor operativo');
});

// Rutas de la API REST
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/puestos', puestoRoutes);
app.use('/api/cultos', cultoRoutes);
app.use('/api/turnos', turnoRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/avisos', avisoRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);

// Manejador 404 para rutas de la API no encontradas
app.use('/api', (req, res) => {
  return fallo(res, `Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404);
});

// Fallback para SPA / Frontend: devolver index.html si no es llamada a la API
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Manejador global de errores (Principio SSD: no fugar trazas de stack trace sensibles)
app.use((err, req, res, next) => {
  console.error('[ERROR NO CAPTURADO]:', err.stack);
  return fallo(
    res,
    process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor. Por favor contacte al administrador.'
      : err.message,
    500
  );
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  Sistema de Gestión de Diáconos (Metodología SSD)     `);
    console.log(`  Servidor activo en: http://localhost:${PORT}         `);
    console.log(`=======================================================`);
  });
}

module.exports = app;
