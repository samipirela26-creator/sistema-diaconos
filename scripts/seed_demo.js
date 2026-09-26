const bcrypt = require('bcryptjs');
const db = require('../config/database');
const inicializarBaseDatos = require('./init_db');

function seedDemo() {
  console.log('--- Cargando datos de demostración ---');
  inicializarBaseDatos();

  const hashDefault = bcrypt.hashSync('Diacono123*', 10);
  const hashLider = bcrypt.hashSync('Lider1234*', 10);

  // 1. Crear Líder de Diáconos
  const existeLider = db.prepare("SELECT id FROM usuarios WHERE username = 'lider'").get();
  let liderId;
  if (!existeLider) {
    const resLider = db.prepare(`
      INSERT INTO usuarios (username, email, password_hash, nombre_completo, telefono, rol, activo)
      VALUES (?, ?, ?, ?, ?, 'lider', 1)
    `).run('lider', 'lider@iglesia.local', hashLider, 'David Morales (Líder)', '0414-1234567');
    liderId = resLider.lastInsertRowid;
    console.log('✓ Creado Líder de Diáconos: usuario "lider" / clave "Lider1234*"');
  } else {
    liderId = existeLider.id;
  }

  // 2. Crear Diáconos de prueba
  const diaconos = [
    { username: 'carlos', nombre: 'Carlos Méndez', telf: '0424-2345678', email: 'carlos@iglesia.local' },
    { username: 'juan', nombre: 'Juan Pérez', telf: '0412-3456789', email: 'juan@iglesia.local' },
    { username: 'andres', nombre: 'Andrés Gómez', telf: '0416-4567890', email: 'andres@iglesia.local' },
    { username: 'marcos', nombre: 'Marcos Silva', telf: '0426-5678901', email: 'marcos@iglesia.local' },
    { username: 'pedro', nombre: 'Pedro Rondón', telf: '0414-6789012', email: 'pedro@iglesia.local' }
  ];

  const stmtDiacono = db.prepare(`
    INSERT OR IGNORE INTO usuarios (username, email, password_hash, nombre_completo, telefono, rol, activo)
    VALUES (?, ?, ?, ?, ?, 'diacono', 1)
  `);

  for (const d of diaconos) {
    stmtDiacono.run(d.username, d.email, hashDefault, d.nombre, d.telf);
  }
  console.log('✓ Diáconos de prueba creados (clave común: "Diacono123*")');

  // 3. Crear cultos para el fin de semana próximo
  const hoy = new Date();
  const proximoDomingo = new Date(hoy);
  proximoDomingo.setDate(hoy.getDate() + ((7 - hoy.getDay()) % 7 || 7));
  const fechaDom = proximoDomingo.toISOString().split('T')[0];

  const proximoMiercoles = new Date(hoy);
  proximoMiercoles.setDate(hoy.getDate() + ((3 - hoy.getDay() + 7) % 7 || 7));
  const fechaMie = proximoMiercoles.toISOString().split('T')[0];

  const cultos = [
    {
      titulo: 'Culto Dominical - Mañana',
      fecha: fechaDom,
      hora_inicio: '09:00',
      hora_fin: '11:30',
      tipo: 'culto',
      desc: 'Culto principal de alabanza y adoración de la mañana'
    },
    {
      titulo: 'Culto Dominical - Tarde',
      fecha: fechaDom,
      hora_inicio: '17:00',
      hora_fin: '19:00',
      tipo: 'culto',
      desc: 'Reunión vespertina y servicio de jóvenes'
    },
    {
      titulo: 'Culto de Oración y Doctrina',
      fecha: fechaMie,
      hora_inicio: '18:30',
      hora_fin: '20:00',
      tipo: 'culto',
      desc: 'Estudio bíblico entre semana y comunión'
    }
  ];

  const stmtCulto = db.prepare(`
    INSERT INTO cultos_eventos (titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of cultos) {
    const existe = db.prepare('SELECT id FROM cultos_eventos WHERE titulo = ? AND fecha = ?').get(c.titulo, c.fecha);
    if (!existe) {
      const resCulto = stmtCulto.run(c.titulo, c.fecha, c.hora_inicio, c.hora_fin, c.tipo, c.desc, liderId);
      const cultoId = resCulto.lastInsertRowid;

      // Asignar algunos turnos en el culto dominical mañana
      if (c.titulo.includes('Mañana')) {
        const puestos = db.prepare('SELECT id FROM puestos_servicio LIMIT 4').all();
        const diacList = db.prepare("SELECT id FROM usuarios WHERE rol = 'diacono' LIMIT 4").all();

        const insertTurno = db.prepare(`
          INSERT OR IGNORE INTO turnos_asignados (culto_id, puesto_id, usuario_id, estado_asistencia, asignado_por)
          VALUES (?, ?, ?, ?, ?)
        `);

        if (puestos.length >= 2 && diacList.length >= 2) {
          insertTurno.run(cultoId, puestos[0].id, diacList[0].id, 'confirmado', liderId);
          insertTurno.run(cultoId, puestos[1].id, diacList[1].id, 'pendiente', liderId);
        }
      }
    }
  }
  // 4. Sembrar Avisos de Demostración
  const totalAvisos = db.prepare('SELECT COUNT(*) as total FROM avisos').get().total;
  if (totalAvisos === 0) {
    const stmtAviso = db.prepare(`
      INSERT INTO avisos (titulo, contenido, tipo, fijado, creado_por)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmtAviso.run(
      'Reunión Mensual del Cuerpo de Diáconos',
      'Hermanos diáconos, este sábado a las 5:00 PM tendremos nuestra reunión mensual de oración, evaluación de servicios y coordinación del cuadrante del mes. Se ruega puntual asistencia.',
      'importante',
      1,
      liderId
    );

    stmtAviso.run(
      'Código de Vestimenta para el Domingo de Santa Cena',
      'Recordatorio para el próximo domingo de Santa Cena: todos los servidores en plataforma y ofrendas vestir con traje formal oscuro y corbata vinotinto o azul.',
      'general',
      0,
      liderId
    );
    console.log('✓ Avisos y comunicados de prueba creados.');
  }

  // 5. Sembrar un reporte de asistencia previo para alimentar los gráficos
  const totalReportes = db.prepare('SELECT COUNT(*) as total FROM reportes_culto').get().total;
  if (totalReportes === 0) {
    const cultosExistentes = db.prepare('SELECT id FROM cultos_eventos LIMIT 1').all();
    if (cultosExistentes.length > 0) {
      db.prepare(`
        INSERT OR IGNORE INTO reportes_culto (
          culto_id, registrado_por, asistencia_hermanos, asistencia_ninos, visitas_primeravez,
          asistencia_total, ofrenda_monto, novedades_incidencias, aprobado_por_lider
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        cultosExistentes[0].id,
        liderId,
        145,
        38,
        12,
        195,
        420.00,
        'Culto concurrido y bendecido. Recepción de 12 visitas primerizas en módulo de información.'
      );
      console.log('✓ Reporte de culto previo registrado para métricas y gráficos.');
    }
  }

  console.log('✓ Cultos de ejemplo y asignaciones programadas.');
  console.log('--- Datos de demostración listos ---');
}

if (require.main === module) {
  seedDemo();
}

module.exports = seedDemo;
