-- Esquema de Base de Datos - Sistema de Diaconos
-- Principios SSD: Integridad referencial, validaciones CHECK y unicidad

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    telefono TEXT,
    rol TEXT NOT NULL CHECK(rol IN ('root', 'lider', 'diacono')),
    activo INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS puestos_servicio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    cupo_sugerido INTEGER DEFAULT 1,
    orden INTEGER DEFAULT 0,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cultos_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    fecha TEXT NOT NULL, -- Formato ISO: YYYY-MM-DD
    hora_inicio TEXT NOT NULL, -- Formato: HH:MM
    hora_fin TEXT, -- Formato: HH:MM
    tipo TEXT DEFAULT 'culto',
    descripcion TEXT,
    estado TEXT NOT NULL DEFAULT 'programado' CHECK(estado IN ('programado', 'en_curso', 'finalizado', 'cancelado')),
    creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS turnos_asignados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    culto_id INTEGER NOT NULL REFERENCES cultos_eventos(id) ON DELETE CASCADE,
    puesto_id INTEGER NOT NULL REFERENCES puestos_servicio(id) ON DELETE RESTRICT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    estado_asistencia TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado_asistencia IN ('pendiente', 'confirmado', 'excusado', 'asistio', 'inasistencia')),
    motivo_excusa TEXT,
    notas TEXT,
    asignado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(culto_id, puesto_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS reportes_culto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    culto_id INTEGER NOT NULL UNIQUE REFERENCES cultos_eventos(id) ON DELETE CASCADE,
    registrado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    asistencia_hermanos INTEGER DEFAULT 0,
    asistencia_ninos INTEGER DEFAULT 0,
    visitas_primeravez INTEGER DEFAULT 0,
    asistencia_total INTEGER DEFAULT 0,
    ofrenda_monto REAL DEFAULT 0.0,
    novedades_incidencias TEXT,
    aprobado_por_lider INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    username TEXT,
    accion TEXT NOT NULL,
    modulo TEXT NOT NULL,
    detalle TEXT,
    ip TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS avisos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    tipo TEXT DEFAULT 'general' CHECK(tipo IN ('general', 'importante', 'urgente')),
    fijado INTEGER DEFAULT 0,
    creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS disponibilidad (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL, -- YYYY-MM-DD
    motivo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, fecha)
);

-- Índices de optimización y búsqueda
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_cultos_fecha ON cultos_eventos(fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_culto ON turnos_asignados(culto_id);
CREATE INDEX IF NOT EXISTS idx_turnos_usuario ON turnos_asignados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha);
CREATE INDEX IF NOT EXISTS idx_disponibilidad_fecha ON disponibilidad(fecha);
