const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Configurar entorno de pruebas
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(__dirname, '../data/test_diaconos.db');

// Limpiar base de datos de test si existe
if (fs.existsSync(process.env.DB_PATH)) {
  fs.unlinkSync(process.env.DB_PATH);
}

// Inicializar DB de pruebas
const db = require('../config/database');
const inicializarBaseDatos = require('../scripts/init_db');
inicializarBaseDatos();

const request = async (app, method, url, body = null, token = null) => {
  const http = require('http');
  const server = app.listen(0);
  const port = server.address().port;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const payload = body ? JSON.stringify(body) : null;
  if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: url,
        method,
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          server.close();
          try {
            const data = rawData ? JSON.parse(rawData) : null;
            resolve({ status: res.statusCode, body: data });
          } catch (e) {
            resolve({ status: res.statusCode, raw: rawData });
          }
        });
      }
    );

    req.on('error', (err) => {
      server.close();
      reject(err);
    });

    if (payload) req.write(payload);
    req.end();
  });
};

const app = require('../server');

test('=== SUITE METODOLOGÍA SSD: SEGURIDAD, RBAC Y REGLAS DE NEGOCIO ===', async (t) => {
  let tokenRoot = '';
  let tokenLider = '';
  let tokenDiacono = '';
  let idDiacono = 0;
  let idCulto = 0;
  let idPuesto = 0;
  let idTurno = 0;

  await t.test('1. Autenticación: Login Root con contraseña inicial', async () => {
    const res = await request(app, 'POST', '/api/auth/login', {
      username: 'root',
      password: 'RootDiacono2026*'
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.data.token, 'Debe devolver un JWT');
    assert.equal(res.body.data.usuario.rol, 'root');
    assert.equal(res.body.data.usuario.password_hash, undefined, 'No debe filtrar el hash');
    tokenRoot = res.body.data.token;
  });

  await t.test('2. Seguridad: Rechazo de credenciales incorrectas', async () => {
    const res = await request(app, 'POST', '/api/auth/login', {
      username: 'root',
      password: 'ClaveTotalmenteIncorrecta'
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
  });

  await t.test('3. RBAC: Root crea un Líder de Diáconos', async () => {
    const res = await request(app, 'POST', '/api/usuarios', {
      username: 'lider_test',
      password: 'LiderPassword123*',
      nombre_completo: 'Líder de Prueba',
      telefono: '0414-9999999',
      rol: 'lider'
    }, tokenRoot);

    assert.equal(res.status, 201);
    assert.equal(res.body.data.rol, 'lider');

    // Login del Líder creado
    const loginLider = await request(app, 'POST', '/api/auth/login', {
      username: 'lider_test',
      password: 'LiderPassword123*'
    });
    tokenLider = loginLider.body.data.token;
  });

  await t.test('4. RBAC: Líder puede crear Diácono, pero NO puede crear Root', async () => {
    // Intento no autorizado: Líder creando un Root (debe fallar 403)
    const resRootFail = await request(app, 'POST', '/api/usuarios', {
      username: 'hacker_root',
      password: 'Password123*',
      nombre_completo: 'Intruso Root',
      rol: 'root'
    }, tokenLider);

    assert.equal(resRootFail.status, 403, 'Líder no tiene permiso para crear usuario Root');

    // Creación permitida: Líder creando Diácono
    const resDiaconoOk = await request(app, 'POST', '/api/usuarios', {
      username: 'diacono_test',
      password: 'DiaconoPassword123*',
      nombre_completo: 'Hermano Diácono Test',
      telefono: '0424-8888888',
      rol: 'diacono'
    }, tokenLider);

    assert.equal(resDiaconoOk.status, 201);
    idDiacono = resDiaconoOk.body.data.id;

    // Login del Diácono
    const loginDiacono = await request(app, 'POST', '/api/auth/login', {
      username: 'diacono_test',
      password: 'DiaconoPassword123*'
    });
    tokenDiacono = loginDiacono.body.data.token;
  });

  await t.test('5. RBAC: Diácono NO puede crear usuarios ni consultar auditoría', async () => {
    // Diácono intentando crear usuario
    const resCrear = await request(app, 'POST', '/api/usuarios', {
      username: 'otro_user',
      password: 'Password123*',
      nombre_completo: 'Intento',
      rol: 'diacono'
    }, tokenDiacono);
    assert.equal(resCrear.status, 403, 'Diácono debe recibir 403 Forbidden');

    // Diácono intentando ver logs de auditoría
    const resAudit = await request(app, 'GET', '/api/auditoria', null, tokenDiacono);
    assert.equal(resAudit.status, 403, 'Diácono no debe ver bitácora de auditoría');
  });

  await t.test('6. Cultos y Asignación de Turnos', async () => {
    // Líder crea un culto dominical
    const resCulto = await request(app, 'POST', '/api/cultos', {
      titulo: 'Culto Dominical Test',
      fecha: '2026-10-04',
      hora_inicio: '09:00',
      hora_fin: '11:30',
      tipo: 'culto',
      descripcion: 'Culto de prueba para turnos'
    }, tokenLider);

    assert.equal(resCulto.status, 201);
    idCulto = resCulto.body.data.id;

    // Obtener puestos existentes
    const resPuestos = await request(app, 'GET', '/api/puestos', null, tokenLider);
    assert.equal(resPuestos.status, 200);
    idPuesto = resPuestos.body.data[0].id;

    // Líder asigna al Diácono al puesto
    const resTurno = await request(app, 'POST', '/api/turnos/asignar', {
      culto_id: idCulto,
      puesto_id: idPuesto,
      usuario_id: idDiacono,
      notas: 'Llegar 20 minutos antes para recibir a la congregación'
    }, tokenLider);

    assert.equal(resTurno.status, 201);
    idTurno = resTurno.body.data.id;

    // Validar prevención de doble turno en el mismo culto para el mismo diácono
    const resDuplicado = await request(app, 'POST', '/api/turnos/asignar', {
      culto_id: idCulto,
      puesto_id: idPuesto,
      usuario_id: idDiacono
    }, tokenLider);

    assert.equal(resDuplicado.status, 400, 'Debe impedir doble asignación en el mismo culto');
  });

  await t.test('7. Diácono: Visualización y Confirmación de su Turno', async () => {
    // Diácono consulta "mis turnos"
    const resMis = await request(app, 'GET', '/api/turnos/mis-turnos', null, tokenDiacono);
    assert.equal(resMis.status, 200);
    assert.ok(resMis.body.data.length >= 1);
    assert.equal(resMis.body.data[0].estado_asistencia, 'pendiente');

    // Diácono confirma su asistencia al turno
    const resResp = await request(app, 'POST', `/api/turnos/${idTurno}/responder`, {
      estado_asistencia: 'confirmado'
    }, tokenDiacono);

    assert.equal(resResp.status, 200);
    assert.equal(resResp.body.data.estado_asistencia, 'confirmado');
  });

  await t.test('8. Reporte de Culto (Conteo de Asistencia y Ofrenda)', async () => {
    // Diácono asignado guarda el reporte de conteo
    const resReporte = await request(app, 'POST', '/api/reportes', {
      culto_id: idCulto,
      asistencia_hermanos: 120,
      asistencia_ninos: 35,
      visitas_primeravez: 8,
      ofrenda_monto: 350.50,
      novedades_incidencias: 'Sin incidencias. Dos familias nuevas acogidas.'
    }, tokenDiacono);

    assert.equal(resReporte.status, 201);
    assert.equal(resReporte.body.data.asistencia_total, 163, 'La suma debe ser 120 + 35 + 8 = 163');
  });

  await t.test('9. Auditoría SSD: Verificar que las acciones quedaron registradas', async () => {
    const resAudit = await request(app, 'GET', '/api/auditoria', null, tokenRoot);
    assert.equal(resAudit.status, 200);
    assert.ok(resAudit.body.data.logs.length > 0, 'La bitácora de auditoría no debe estar vacía');

    const modulos = resAudit.body.data.logs.map(l => l.modulo);
    assert.ok(modulos.includes('AUTH'), 'Debe existir auditoría de AUTH');
    assert.ok(modulos.includes('USUARIOS'), 'Debe existir auditoría de USUARIOS');
    assert.ok(modulos.includes('TURNOS'), 'Debe existir auditoría de TURNOS');
    assert.ok(modulos.includes('REPORTES'), 'Debe existir auditoría de REPORTES');
  });
});
