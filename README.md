# Sistema de Gestión de Diáconos (Metodología SSD)

Sistema web integral y seguro para la gestión del cuerpo de diáconos y servidores de una congregación eclesiástica, desarrollado bajo la **metodología SSD**:
1. **Spec-Driven Development (SDD/SSD)**: Arquitectura guiada por especificaciones rigurosas, contratos de API estandarizados (`ok()` / `fallo()`) y modelo de datos relacional con integridad referencial estricta.
2. **Secure Software Development (SSD / SSDLC)**: Seguridad por diseño (*Security by Design*), principio de mínimo privilegio con RBAC estricto, hashing bcrypt, protección contra fuerza bruta, prevención de IDOR y bitácora de auditoría inmutable.

---

## 👥 Matriz de Roles y Control de Acceso (RBAC)

| Módulo / Acción | `root` (Super Admin) | `lider` (Líder de Diáconos) | `diacono` (Servidor) |
|---|:---:|:---:|:---:|
| **Acceso general** | Control total de la plataforma | Gestión operativa del equipo | Vista personal y de servicio |
| **Tablón de avisos** | Publicar y moderar comunicados | Publicar y moderar comunicados | 👁️ Lectura de avisos |
| **Mi Disponibilidad** | Consultar ausencias del equipo | Consultar ausencias del equipo | ✅ Notificar fechas de ausencia |
| **Gestión de usuarios** | Crear/Modificar `root`, `lider`, `diacono` | Registrar y gestionar `diaconos` | 👁️ Directorio de contactos |
| **Puestos de servicio** | Configurar puestos y cupos | Configurar puestos y cupos | 👁️ Solo lectura |
| **Programación de cultos** | Crear, editar y eliminar | Crear, editar y eliminar | 👁️ Solo lectura |
| **Cuadrante de turnos** | Asignar y desasignar | Asignar y desasignar | 👁️ Solo lectura |
| **Confirmación de turno** | N/A | Gestionar respuestas | ✅ Confirmar o excusarse |
| **Exportación WhatsApp e Impresión** | ✅ Copiar y mandar recordatorios | ✅ Copiar y mandar recordatorios | ✅ Enlaces directos a WhatsApp |
| **Reportes de asistencia** | Ver métricas y reportes | Crear, aprobar y consultar | ✅ Cargar conteo si está de turno |
| **Bitácora de auditoría** | ✅ Consulta completa de logs | ✅ Consulta completa de logs | ❌ Sin acceso (403) |
| **Validación preventiva de turnos** | ✅ Bloqueo si está ausente | ✅ Bloqueo si está ausente | N/A |

---

## 🔑 Credenciales de Acceso de Demostración

| Rol | Usuario | Contraseña | Propósito |
|---|---|---|---|
| **Root (Admin)** | `root` | `RootDiacono2026*` | Configuración global, puestos, usuarios y auditoría |
| **Líder de Diáconos** | `lider` | `Lider1234*` | Planificación de cultos, asignación de turnos y aprobación de reportes |
| **Diácono 1** | `carlos` | `Diacono123*` | Ver sus turnos asignados, confirmar asistencia y reportar culto |
| **Diácono 2** | `juan` | `Diacono123*` | Ver sus turnos asignados y consultar directorio de compañeros |

---

## 🚀 Comandos de Ejecución

### 1. Inicializar la Base de Datos
Crea las tablas, índices, usuario root y puestos de servicio estándar:
```bash
npm run init-db
```

### 2. Cargar Datos de Demostración
Crea el líder, diáconos de ejemplo y cultos programados:
```bash
npm run seed
```

### 3. Iniciar el Servidor
```bash
npm start
```
El sistema estará accesible en el navegador en: **`http://localhost:3000`**

### 4. Ejecutar la Suite de Pruebas Automatizadas
Pruebas de seguridad, autenticación, RBAC y auditoría:
```bash
npm test
```

---

## 📁 Estructura del Proyecto

```
├── config/
│   └── database.js            # Conexión SQLite (better-sqlite3) con WAL y Foreign Keys activas
├── src/
│   ├── controllers/           # Controladores de negocio (auth, usuarios, cultos, turnos, reportes, auditoria)
│   ├── db/
│   │   └── schema.sql         # Esquema DDL de tablas relacionales e índices
│   ├── helpers/
│   │   └── respuesta.js       # Contrato de respuesta uniforme ok() y fallo()
│   ├── middleware/
│   │   ├── auth.js            # Validación de JWT y filtro RBAC requiereRol()
│   │   ├── audit.js           # Registro automático de eventos en bitácora inmutable
│   │   └── rateLimiter.js     # Protección contra ataques de fuerza bruta
│   └── routes/                # Rutas REST montadas por módulo
├── public/                    # Frontend Web Responsivo (Mobile & Desktop)
│   ├── css/style.css          # Estilos modernos con paleta azul ministerial y badges
│   ├── js/app.js              # Lógica de interfaz de usuario reactiva y consumo seguro de API
│   └── index.html             # Vistas por pestañas y modales de acción
├── scripts/
│   ├── init_db.js             # Migración y arranque seguro
│   └── seed_demo.js           # Semillero de datos de prueba
├── tests/
│   └── seguridad_rbac.test.js # Pruebas unitarias y de integración de seguridad
├── server.js                  # Punto de entrada Express y middlewares de producción
└── package.json
```

---

## 🛡️ Medidas de Seguridad Implementadas (Metodología SSD)

1. **Autenticación Fuerte**: Contraseñas cifradas mediante `bcrypt` con 10 rondas de salt.
2. **Tokens JWT Criptográficos**: Tokens de sesión firmados con verificación contra base de datos en cada petición para invalidar inmediatamente cuentas desactivadas.
3. **Control de Acceso Basado en Roles (RBAC)**: Reglas de autorización validadas en backend para evitar escalado horizontal y vertical de privilegios.
4. **Protección Anti Fuerza Bruta**: `express-rate-limit` protegiendo los intentos de login (máximo 10 intentos cada 15 min por IP).
5. **Consultas Parametrizadas**: Mitigación total de SQL Injection al utilizar sentencias preparadas nativas en SQLite.
6. **Bitácora Inmutable de Auditoría**: Toda acción administrativa (creación de usuarios, cambios de turnos, inicios de sesión) queda registrada con usuario, fecha e IP.
