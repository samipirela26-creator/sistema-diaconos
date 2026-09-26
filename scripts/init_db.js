const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

function inicializarBaseDatos() {
  console.log('--- Inicializando Base de Datos (Metodología SSD) ---');

  // 1. Ejecutar esquema SQL
  const schemaPath = path.join(__dirname, '../src/db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  console.log('✓ Esquema e índices creados correctamente');

  // 2. Verificar y crear usuario ROOT por defecto si no existe
  const rootExiste = db.prepare("SELECT id FROM usuarios WHERE rol = 'root'").get();

  if (!rootExiste) {
    const passwordRoot = process.env.ROOT_PASSWORD || 'RootDiacono2026*';
    const hash = bcrypt.hashSync(passwordRoot, 10);

    const stmt = db.prepare(`
      INSERT INTO usuarios (username, email, password_hash, nombre_completo, telefono, rol, activo)
      VALUES (?, ?, ?, ?, ?, 'root', 1)
    `);

    stmt.run('root', 'root@iglesia.local', hash, 'Administrador Root', '000-0000000');
    console.log('✓ Usuario ROOT creado:');
    console.log(`    Usuario: root`);
    console.log(`    Contraseña inicial: ${passwordRoot}`);
  } else {
    console.log('✓ Usuario ROOT ya existente');
  }

  // 3. Crear puestos de servicio estándar si la tabla está vacía
  const totalPuestos = db.prepare('SELECT COUNT(*) as total FROM puestos_servicio').get().total;
  if (totalPuestos === 0) {
    const puestosDefecto = [
      { nombre: 'Puerta Principal (Bienvenida)', desc: 'Recepción cordial de feligreses y entrega de boletines', cupo: 2, orden: 1 },
      { nombre: 'Pasillo Central (Acomodación)', desc: 'Guiar a los asistentes a los asientos disponibles', cupo: 2, orden: 2 },
      { nombre: 'Ofrendas y Diezmos', desc: 'Recolección organizada de ofrendas durante el culto', cupo: 4, orden: 3 },
      { nombre: 'Santa Cena / Comunión', desc: 'Distribución solemne de elementos de la Santa Cena', cupo: 4, orden: 4 },
      { nombre: 'Parqueo y Seguridad Externa', desc: 'Supervisión del estacionamiento y accesos exteriores', cupo: 2, orden: 5 },
      { nombre: 'Módulo de Información / Visitas', desc: 'Atención a personas que asisten por primera vez', cupo: 1, orden: 6 },
      { nombre: 'Soporte y Orden de Plataforma', desc: 'Asistencia al pastor y predicador invitado', cupo: 1, orden: 7 }
    ];

    const insertPuesto = db.prepare(`
      INSERT INTO puestos_servicio (nombre, descripcion, cupo_sugerido, orden, activo)
      VALUES (?, ?, ?, ?, 1)
    `);

    const transaccion = db.transaction((puestos) => {
      for (const p of puestos) {
        insertPuesto.run(p.nombre, p.desc, p.cupo, p.orden);
      }
    });

    transaccion(puestosDefecto);
    console.log(`✓ Se registraron ${puestosDefecto.length} puestos de servicio estándar.`);
  }

  console.log('--- Inicialización completada exitosamente ---\n');
}

if (require.main === module) {
  inicializarBaseDatos();
}

module.exports = inicializarBaseDatos;
