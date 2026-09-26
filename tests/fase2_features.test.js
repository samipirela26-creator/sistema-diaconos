const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(__dirname, '../data/test_fase2.db');

if (fs.existsSync(process.env.DB_PATH)) {
  fs.unlinkSync(process.env.DB_PATH);
}

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

test('=== FASE 2: TABLÓN DE AVISOS, DISPONIBILIDAD Y VALIDACIÓN PREVENTIVA ===', async (t) => {
  let tokenRoot = '';
  let tokenLider = '';
  let tokenDiacono = '';
  let idDiacono = 0;
  let idCulto = 0;
  let idPuesto = 0;
  let idAviso = 0;
  let idDisp = 0;

  await t.test('1. Setup de usuarios (Root, Líder, Diácono)', async () => {
    // Login Root
    const resRoot = await request(app, 'POST', '/api/auth/login', { username: 'root', password: 'RootDiacono2026*' });
    tokenRoot = resRoot.body.data.token;

    // Crear Líder
    await request(app, 'POST', '/api/usuarios', {
      username: 'lider_f2',
      password: 'LiderPassword123*',
      nombre_completo: 'Líder Fase 2',
      rol: 'lider'
    }, tokenRoot);

    const resLoginLider = await request(app, 'POST', '/api/auth/login', { username: 'lider_f2', password: 'LiderPassword123*' });
    tokenLider = resLoginLider.body.data.token;

    // Líder crea Diácono
    const resDiac = await request(app, 'POST', '/api/usuarios', {
      username: 'diacono_f2',
      password: 'DiaconoPassword123*',
      nombre_completo: 'Hermano Ausente Test',
      rol: 'diacono'
    }, tokenLider);
    idDiacono = resDiac.body.data.id;

    const resLoginDiac = await request(app, 'POST', '/api/auth/login', { username: 'diacono_f2', password: 'DiaconoPassword123*' });
    tokenDiacono = resLoginDiac.body.data.token;
  });

  await t.test('2. Avisos: Líder publica anuncio y Diácono lo visualiza', async () => {
    // Líder publica aviso
    const resAviso = await request(app, 'POST', '/api/avisos', {
      titulo: 'Reunión de Coordinación Previa',
      contenido: 'Hermanos, nos reuniremos 30 minutos antes del culto para orar juntos.',
      tipo: 'importante',
      fijado: 1
    }, tokenLider);

    assert.equal(resAviso.status, 201);
    idAviso = resAviso.body.data.id;

    // Diácono consulta lista de avisos
    const resLista = await request(app, 'GET', '/api/avisos', null, tokenDiacono);
    assert.equal(resLista.status, 200);
    assert.ok(resLista.body.data.length >= 1);
    assert.equal(resLista.body.data[0].titulo, 'Reunión de Coordinación Previa');

    // Diácono NO puede publicar avisos (RBAC 403)
    const resAvisoFail = await request(app, 'POST', '/api/avisos', {
      titulo: 'Intento Diacono',
      contenido: 'No permitido'
    }, tokenDiacono);
    assert.equal(resAvisoFail.status, 403);
  });

  await t.test('3. Disponibilidad: Diácono declara que no estará disponible un domingo', async () => {
    const resDisp = await request(app, 'POST', '/api/disponibilidad', {
      fecha: '2026-10-18',
      motivo: 'Viaje de trabajo fuera de la ciudad'
    }, tokenDiacono);

    assert.equal(resDisp.status, 201);
    idDisp = resDisp.body.data.id;
  });

  await t.test('4. Prevención: El sistema BLOQUEA asignar un turno al diácono en esa fecha', async () => {
    // Crear culto para esa misma fecha
    const resCulto = await request(app, 'POST', '/api/cultos', {
      titulo: 'Culto Especial Octubre',
      fecha: '2026-10-18',
      hora_inicio: '10:00',
      tipo: 'culto'
    }, tokenLider);
    idCulto = resCulto.body.data.id;

    const resPuestos = await request(app, 'GET', '/api/puestos', null, tokenLider);
    idPuesto = resPuestos.body.data[0].id;

    // Líder intenta asignar al diácono que marcó indisponible
    const resIntento = await request(app, 'POST', '/api/turnos/asignar', {
      culto_id: idCulto,
      puesto_id: idPuesto,
      usuario_id: idDiacono
    }, tokenLider);

    assert.equal(resIntento.status, 400);
    assert.ok(resIntento.body.error.includes('NO está disponible'));
    assert.ok(resIntento.body.error.includes('Viaje de trabajo'));
  });

  await t.test('5. Disponibilidad: Al liberar la fecha, se permite la asignación', async () => {
    // Diácono elimina su indisponibilidad
    const resDel = await request(app, 'DELETE', `/api/disponibilidad/${idDisp}`, null, tokenDiacono);
    assert.equal(resDel.status, 200);

    // Ahora el Líder sí puede asignarlo
    const resAsignarOk = await request(app, 'POST', '/api/turnos/asignar', {
      culto_id: idCulto,
      puesto_id: idPuesto,
      usuario_id: idDiacono
    }, tokenLider);

    assert.equal(resAsignarOk.status, 201);
  });

  await t.test('6. Respaldo: Exportación e importación de base de datos en JSON (v105)', async () => {
    // Exportar respaldo como Líder o Root
    const resExport = await request(app, 'GET', '/api/respaldo/exportar', null, tokenRoot);
    assert.equal(resExport.status, 200);
    assert.equal(resExport.body.version, 'v105');
    assert.ok(resExport.body.data.cultos.length >= 1);
    assert.ok(resExport.body.data.turnos.length >= 1);

    // Diácono no puede importar ni exportar (403)
    const resFailDiac = await request(app, 'GET', '/api/respaldo/exportar', null, tokenDiacono);
    assert.equal(resFailDiac.status, 403);

    // Root restaura el respaldo
    const resImport = await request(app, 'POST', '/api/respaldo/importar', resExport.body, tokenRoot);
    assert.equal(resImport.status, 200);
    assert.equal(resImport.body.ok, true);
  });
});

