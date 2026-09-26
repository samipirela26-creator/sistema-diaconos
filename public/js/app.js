/**
 * Frontend de Gestión de Diáconos (Metodología SSD)
 * Manejo de estado, consumo seguro de API REST con JWT y control de interfaz RBAC
 */

const App = {
  token: localStorage.getItem('token') || null,
  usuario: JSON.parse(localStorage.getItem('usuario') || 'null'),
  tabActiva: 'mis-turnos',

  // Inicialización de la aplicación
  init() {
    this.vincularEventos();
    if (this.token && this.usuario) {
      this.aplicarSesion();
    } else {
      this.mostrarLogin();
    }
  },

  // Vinculación de eventos DOM
  vincularEventos() {
    // Formulario de Login
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Botones de sesión
    const btnCerrar = document.getElementById('btnCerrarSesion');
    if (btnCerrar) {
      btnCerrar.addEventListener('click', () => this.cerrarSesion());
    }

    const btnCambiarClave = document.getElementById('btnCambiarClave');
    if (btnCambiarClave) {
      btnCambiarClave.addEventListener('click', () => this.abrirModal('modalCambiarClave'));
    }

    // Formulario de cambio de contraseña
    const formCambiarClave = document.getElementById('formCambiarClave');
    if (formCambiarClave) {
      formCambiarClave.addEventListener('submit', (e) => this.handleCambiarClave(e));
    }

    // Pestañas de navegación
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.cambiarTab(tab);
      });
    });

    // Cerrar modales con [data-close] o clic fuera
    document.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const modalId = el.getAttribute('data-close');
        this.cerrarModal(modalId);
      });
    });

    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.style.display = 'none';
        }
      });
    });

    // Toggle motivo excusa
    const selectEstado = document.getElementById('responderEstado');
    if (selectEstado) {
      selectEstado.addEventListener('change', () => {
        const grupo = document.getElementById('grupoMotivoExcusa');
        grupo.style.display = selectEstado.value === 'excusado' ? 'block' : 'none';
      });
    }

    // Formularios de acciones
    document.getElementById('formCulto')?.addEventListener('submit', (e) => this.guardarCulto(e));
    document.getElementById('formAsignarTurno')?.addEventListener('submit', (e) => this.guardarAsignacion(e));
    document.getElementById('formResponderTurno')?.addEventListener('submit', (e) => this.guardarRespuestaTurno(e));
    document.getElementById('formReporte')?.addEventListener('submit', (e) => this.guardarReporte(e));
    document.getElementById('formUsuario')?.addEventListener('submit', (e) => this.guardarUsuario(e));
    document.getElementById('formPuesto')?.addEventListener('submit', (e) => this.guardarPuesto(e));
    document.getElementById('formAviso')?.addEventListener('submit', (e) => this.guardarAviso(e));
    document.getElementById('formDisponibilidad')?.addEventListener('submit', (e) => this.guardarDisponibilidad(e));

    // Botones de acción principales
    document.getElementById('btnNuevoCulto')?.addEventListener('click', () => this.abrirModalCulto());
    document.getElementById('btnNuevoUsuario')?.addEventListener('click', () => this.abrirModalUsuario());
    document.getElementById('btnNuevoPuesto')?.addEventListener('click', () => this.abrirModalPuesto());
    document.getElementById('btnNuevoAviso')?.addEventListener('click', () => this.abrirModalAviso());
    document.getElementById('btnNuevaDisponibilidad')?.addEventListener('click', () => this.abrirModalDisponibilidad());
  },

  // Helper para peticiones a la API con JWT
  async apiFetch(url, options = {}) {
    const headers = options.headers || {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const respuesta = await fetch(url, { ...options, headers });
      const datos = await respuesta.json();

      if (respuesta.status === 401) {
        this.cerrarSesion('Tu sesión ha expirado. Ingresa de nuevo.');
        return null;
      }

      if (!respuesta.ok) {
        throw new Error(datos.error || 'Error en la petición');
      }

      return datos;
    } catch (err) {
      this.mostrarToast(err.message, 'error');
      return null;
    }
  },

  // Inicio de Sesión
  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    const res = await this.apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (res && res.ok) {
      this.token = res.data.token;
      this.usuario = res.data.usuario;
      localStorage.setItem('token', this.token);
      localStorage.setItem('usuario', JSON.stringify(this.usuario));
      this.mostrarToast(`¡Bienvenido, ${this.usuario.nombre_completo}!`, 'success');
      this.aplicarSesion();
    }
  },

  // Cierre de Sesión
  cerrarSesion(mensaje = 'Sesión cerrada correctamente') {
    this.token = null;
    this.usuario = null;
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this.mostrarLogin();
    if (mensaje) this.mostrarToast(mensaje, 'info');
  },

  // Mostrar vista de Login
  mostrarLogin() {
    document.getElementById('viewLogin').style.display = 'flex';
    document.getElementById('userNav').style.display = 'none';
    document.getElementById('navTabsWrapper').style.display = 'none';
    document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  },

  // Aplicar UI tras inicio de sesión exitoso según Rol (RBAC)
  aplicarSesion() {
    document.getElementById('viewLogin').style.display = 'none';
    document.getElementById('userNav').style.display = 'flex';
    document.getElementById('navTabsWrapper').style.display = 'block';

    // Rellenar información de usuario en la barra
    document.getElementById('navUserName').textContent = this.usuario.nombre_completo;
    const pill = document.getElementById('navUserRole');
    pill.textContent = this.usuario.rol === 'root' ? 'ROOT' : (this.usuario.rol === 'lider' ? 'LÍDER' : 'DIÁCONO');
    pill.className = `role-pill role-${this.usuario.rol}`;

    // Configurar visibilidad según rol
    const esAdmin = this.usuario.rol === 'root' || this.usuario.rol === 'lider';
    document.getElementById('tabPuestosBtn').style.display = esAdmin ? 'inline-flex' : 'none';
    document.getElementById('tabAuditoriaBtn').style.display = esAdmin ? 'inline-flex' : 'none';
    document.getElementById('btnNuevoCulto').style.display = esAdmin ? 'inline-flex' : 'none';
    document.getElementById('btnNuevoUsuario').style.display = esAdmin ? 'inline-flex' : 'none';
    const btnNuevoAviso = document.getElementById('btnNuevoAviso');
    if (btnNuevoAviso) btnNuevoAviso.style.display = esAdmin ? 'inline-flex' : 'none';

    // Si es Diácono, no puede elegir rol Líder o Root en creación de usuarios
    const optLider = document.getElementById('optRolLider');
    const optRoot = document.getElementById('optRolRoot');
    if (this.usuario.rol === 'lider') {
      if (optLider) optLider.style.display = 'none';
      if (optRoot) optRoot.style.display = 'none';
    }

    this.cambiarTab(this.tabActiva);
  },

  // Cambio de Pestañas
  cambiarTab(tabId) {
    this.tabActiva = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.section-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel-${tabId}`);
    });

    // Cargar datos según la pestaña activa
    switch (tabId) {
      case 'mis-turnos':
        this.cargarMisTurnos();
        break;
      case 'cultos':
        this.cargarCultos();
        break;
      case 'avisos':
        this.cargarAvisos();
        break;
      case 'disponibilidad':
        this.cargarDisponibilidad();
        break;
      case 'reportes':
        this.cargarReportes();
        break;
      case 'equipo':
        this.cargarUsuarios();
        break;
      case 'puestos':
        this.cargarPuestos();
        break;
      case 'auditoria':
        this.cargarAuditoria();
        break;
    }
  },

  // 1. CARGAR MIS TURNOS
  async cargarMisTurnos() {
    const container = document.getElementById('misTurnosContainer');
    container.innerHTML = '<p style="color: var(--text-muted);">Cargando tus turnos asignados...</p>';

    const res = await this.apiFetch('/api/turnos/mis-turnos');
    if (!res || !res.ok) return;

    if (res.data.length === 0) {
      container.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
          <p style="font-size: 1.1rem; color: var(--text-muted);">🎉 No tienes turnos asignados pendientes en este momento.</p>
          <span style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">Tu líder de diáconos te asignará en los próximos cultos.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = res.data.map(t => {
      const fechaFmt = this.formatearFecha(t.culto_fecha);
      const badgeClass = `status-${t.estado_asistencia}`;
      return `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${t.culto_titulo}</div>
              <div class="card-subtitle">📅 ${fechaFmt} • ⏰ ${t.hora_inicio} ${t.hora_fin ? '- ' + t.hora_fin : ''}</div>
            </div>
            <span class="status-badge ${badgeClass}">${t.estado_asistencia}</span>
          </div>

          <div style="background: #f8fafc; padding: 0.85rem; border-radius: var(--radius-sm); border-left: 4px solid var(--primary);">
            <div style="font-weight: 700; color: var(--primary); font-size: 0.95rem;">📍 ${t.puesto_nombre}</div>
            <div style="font-size: 0.825rem; color: var(--text-muted); margin-top: 0.25rem;">${t.puesto_descripcion || 'Responsabilidad general'}</div>
          </div>

          ${t.notas ? `<p style="font-size: 0.8rem; color: var(--text-main); font-style: italic;">📝 <strong>Nota del Líder:</strong> ${t.notas}</p>` : ''}
          ${t.motivo_excusa ? `<p style="font-size: 0.8rem; color: var(--danger);">⚠️ <strong>Tu excusa:</strong> ${t.motivo_excusa}</p>` : ''}

          <div style="margin-top: auto; display: flex; gap: 0.5rem; pt-2">
            ${t.estado_asistencia === 'pendiente' || t.estado_asistencia === 'excusado' ? `
              <button class="btn btn-success btn-sm" onclick="App.responderTurnoRapido(${t.turno_id}, 'confirmado')">
                ✅ Confirmar
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" onclick="App.abrirModalResponder(${t.turno_id}, '${t.culto_titulo}', '${t.puesto_nombre}')">
              Cambiar Respuesta
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  // Respuesta rápida de confirmación
  async responderTurnoRapido(turnoId, estado) {
    const res = await this.apiFetch(`/api/turnos/${turnoId}/responder`, {
      method: 'POST',
      body: JSON.stringify({ estado_asistencia: estado })
    });
    if (res && res.ok) {
      this.mostrarToast('Asistencia confirmada. ¡Gracias por servir!', 'success');
      this.cargarMisTurnos();
    }
  },

  // Abrir modal de respuesta a turno
  abrirModalResponder(turnoId, cultoTitulo, puestoNombre) {
    document.getElementById('responderTurnoId').value = turnoId;
    document.getElementById('responderTurnoInfo').innerHTML = `
      <strong>Culto:</strong> ${cultoTitulo}<br>
      <strong>Puesto:</strong> ${puestoNombre}
    `;
    document.getElementById('responderEstado').value = 'confirmado';
    document.getElementById('grupoMotivoExcusa').style.display = 'none';
    document.getElementById('responderMotivo').value = '';
    this.abrirModal('modalResponderTurno');
  },

  async guardarRespuestaTurno(e) {
    e.preventDefault();
    const id = document.getElementById('responderTurnoId').value;
    const estado_asistencia = document.getElementById('responderEstado').value;
    const motivo_excusa = document.getElementById('responderMotivo').value;

    const res = await this.apiFetch(`/api/turnos/${id}/responder`, {
      method: 'POST',
      body: JSON.stringify({ estado_asistencia, motivo_excusa })
    });

    if (res && res.ok) {
      this.mostrarToast('Respuesta registrada', 'success');
      this.cerrarModal('modalResponderTurno');
      this.cargarMisTurnos();
    }
  },

  // 2. CARGAR CULTOS Y CUADRANTE
  async cargarCultos() {
    const container = document.getElementById('cultosContainer');
    container.innerHTML = '<p style="color: var(--text-muted);">Cargando cultos y cuadrantes...</p>';

    const res = await this.apiFetch('/api/cultos');
    if (!res || !res.ok) return;

    const esAdmin = this.usuario.rol === 'root' || this.usuario.rol === 'lider';

    if (res.data.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">No hay cultos programados.</p>';
      return;
    }

    container.innerHTML = res.data.map(c => {
      const fechaFmt = this.formatearFecha(c.fecha);
      return `
        <div class="card" id="culto-card-${c.id}">
          <div class="card-header">
            <div>
              <div class="card-title">${c.titulo}</div>
              <div class="card-subtitle">📅 ${fechaFmt} • ⏰ ${c.hora_inicio} ${c.hora_fin ? '- ' + c.hora_fin : ''}</div>
            </div>
            <span class="status-badge ${c.estado === 'programado' ? 'status-confirmado' : 'status-inasistencia'}">${c.estado}</span>
          </div>

          <p style="font-size: 0.85rem; color: var(--text-main);">${c.descripcion || 'Sin descripción adicional'}</p>

          <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 1rem;">
            <span>👥 <strong>${c.total_diaconos_asignados}</strong> Diáconos</span>
            <span>✅ <strong>${c.total_confirmados}</strong> Confirmados</span>
            <span>📝 ${c.tiene_reporte ? '<strong style="color: var(--success);">Con Reporte</strong>' : 'Sin Reporte'}</span>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: auto; pt-2">
            <button class="btn btn-secondary btn-sm" onclick="App.verDetalleCulto(${c.id})">
              👁️ Ver Cuadrante
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.copiarCuadranteWhatsApp(${c.id})">
              📲 WhatsApp
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.imprimirCuadrante(${c.id})">
              🖨️ Imprimir
            </button>
            ${esAdmin ? `
              <button class="btn btn-primary btn-sm" onclick="App.abrirModalAsignar(${c.id}, '${c.titulo} - ${fechaFmt}')">
                + Asignar Diácono
              </button>
              <button class="btn btn-secondary btn-sm" onclick="App.abrirModalReporte(${c.id}, '${c.titulo}')">
                📝 Reporte
              </button>
              <button class="btn btn-danger btn-sm" onclick="App.eliminarCulto(${c.id})">
                🗑️
              </button>
            ` : ''}
          </div>

          <div id="detalle-turnos-${c.id}" style="display: none; margin-top: 0.75rem; border-top: 1px solid var(--border); padding-top: 0.75rem;"></div>
        </div>
      `;
    }).join('');
  },

  // Ver cuadrante desplegado de un culto
  async verDetalleCulto(cultoId) {
    const contenedor = document.getElementById(`detalle-turnos-${cultoId}`);
    if (!contenedor) return;

    if (contenedor.style.display === 'block') {
      contenedor.style.display = 'none';
      return;
    }

    contenedor.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Cargando asignaciones...</span>';
    contenedor.style.display = 'block';

    const res = await this.apiFetch(`/api/cultos/${cultoId}`);
    if (!res || !res.ok) return;

    const { culto, turnos } = res.data;
    const esAdmin = this.usuario.rol === 'root' || this.usuario.rol === 'lider';

    if (turnos.length === 0) {
      contenedor.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No hay diáconos asignados aún a este culto.</p>';
      return;
    }

    contenedor.innerHTML = `
      <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--primary);">
        Cuadrante de Puestos (${turnos.length}):
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${turnos.map(t => {
          const telLimpio = t.telefono ? t.telefono.replace(/\D/g, '') : null;
          return `
          <div style="background: #f8fafc; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 0.825rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <strong>${t.puesto_nombre}:</strong> ${t.nombre_completo}
              <span class="status-badge status-${t.estado_asistencia}" style="margin-left: 0.35rem; font-size: 0.7rem; padding: 2px 6px;">
                ${t.estado_asistencia}
              </span>
              ${t.telefono ? `<span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 0.5rem;">📞 ${t.telefono}</span>` : ''}
              ${t.motivo_excusa ? `<div style="color: var(--danger); font-size: 0.75rem;">Motivo: ${t.motivo_excusa}</div>` : ''}
            </div>
            <div style="display: flex; gap: 0.25rem;">
              ${t.telefono ? `
                <button class="btn btn-sm btn-secondary" title="Enviar recordatorio a su WhatsApp" onclick="App.recordarPorWhatsApp('${t.telefono}', '${t.nombre_completo}', '${t.puesto_nombre}', '${culto.titulo}', '${culto.fecha}', '${culto.hora_inicio}')">
                  💬 Recordar
                </button>
              ` : ''}
              ${esAdmin ? `
                <button class="btn btn-sm btn-secondary" title="Marcar asistencia cumplida" onclick="App.marcarAsistenciaReal(${t.id}, 'asistio')">✅</button>
                <button class="btn btn-sm btn-secondary" title="Marcar inasistencia" onclick="App.marcarAsistenciaReal(${t.id}, 'inasistencia')">❌</button>
                <button class="btn btn-sm btn-danger" title="Desasignar" onclick="App.eliminarAsignacion(${t.id}, ${cultoId})">🗑️</button>
              ` : ''}
            </div>
          </div>
        `}).join('')}
      </div>
    `;
  },

  // Modal Culto
  abrirModalCulto() {
    document.getElementById('formCulto').reset();
    document.getElementById('cultoId').value = '';
    document.getElementById('modalCultoTitulo').textContent = 'Programar Nuevo Culto';
    this.abrirModal('modalCulto');
  },

  async guardarCulto(e) {
    e.preventDefault();
    const id = document.getElementById('cultoId').value;
    const payload = {
      titulo: document.getElementById('cultoTitulo').value,
      fecha: document.getElementById('cultoFecha').value,
      hora_inicio: document.getElementById('cultoHoraInicio').value,
      hora_fin: document.getElementById('cultoHoraFin').value || null,
      tipo: document.getElementById('cultoTipo').value,
      descripcion: document.getElementById('cultoDescripcion').value
    };

    const res = await this.apiFetch(id ? `/api/cultos/${id}` : '/api/cultos', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.ok) {
      this.mostrarToast(id ? 'Culto actualizado' : 'Culto programado con éxito', 'success');
      this.cerrarModal('modalCulto');
      this.cargarCultos();
    }
  },

  async eliminarCulto(id) {
    if (!confirm('¿Estás seguro de eliminar este culto y todas sus asignaciones asociadas?')) return;
    const res = await this.apiFetch(`/api/cultos/${id}`, { method: 'DELETE' });
    if (res && res.ok) {
      this.mostrarToast('Culto eliminado', 'info');
      this.cargarCultos();
    }
  },

  // Modal Asignar Diácono a Puesto
  async abrirModalAsignar(cultoId, cultoInfo) {
    document.getElementById('formAsignarTurno').reset();
    document.getElementById('asignarCultoId').value = cultoId;
    document.getElementById('asignarCultoInfo').textContent = cultoInfo;

    // Cargar puestos de servicio activos
    const resPuestos = await this.apiFetch('/api/puestos');
    const selectPuesto = document.getElementById('asignarPuestoId');
    if (resPuestos && resPuestos.ok) {
      selectPuesto.innerHTML = resPuestos.data
        .filter(p => p.activo)
        .map(p => `<option value="${p.id}">${p.nombre} (Cupo sugerido: ${p.cupo_sugerido})</option>`)
        .join('');
    }

    // Cargar diáconos activos
    const resUsuarios = await this.apiFetch('/api/usuarios');
    const selectUsuario = document.getElementById('asignarUsuarioId');
    if (resUsuarios && resUsuarios.ok) {
      selectUsuario.innerHTML = resUsuarios.data
        .filter(u => u.activo && (u.rol === 'diacono' || u.rol === 'lider'))
        .map(u => `<option value="${u.id}">${u.nombre_completo} (${u.rol})</option>`)
        .join('');
    }

    this.abrirModal('modalAsignarTurno');
  },

  async guardarAsignacion(e) {
    e.preventDefault();
    const payload = {
      culto_id: Number(document.getElementById('asignarCultoId').value),
      puesto_id: Number(document.getElementById('asignarPuestoId').value),
      usuario_id: Number(document.getElementById('asignarUsuarioId').value),
      notas: document.getElementById('asignarNotas').value
    };

    const res = await this.apiFetch('/api/turnos/asignar', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.ok) {
      this.mostrarToast('Diácono asignado exitosamente', 'success');
      this.cerrarModal('modalAsignarTurno');
      this.cargarCultos();
    }
  },

  async eliminarAsignacion(turnoId, cultoId) {
    if (!confirm('¿Deseas remover a este diácono del puesto?')) return;
    const res = await this.apiFetch(`/api/turnos/${turnoId}`, { method: 'DELETE' });
    if (res && res.ok) {
      this.mostrarToast('Asignación removida', 'info');
      this.verDetalleCulto(cultoId);
      this.verDetalleCulto(cultoId); // refresca
    }
  },

  async marcarAsistenciaReal(turnoId, estado) {
    const res = await this.apiFetch(`/api/turnos/${turnoId}/asistencia`, {
      method: 'PATCH',
      body: JSON.stringify({ estado_asistencia: estado })
    });
    if (res && res.ok) {
      this.mostrarToast(`Asistencia real marcada: ${estado}`, 'success');
      this.cargarCultos();
    }
  },

  // 3. CARGAR REPORTES
  async cargarReportes() {
    const res = await this.apiFetch('/api/reportes/estadisticas');
    if (!res || !res.ok) return;

    const { stats, ultimos } = res.data;
    document.getElementById('metricAsistencia').textContent = stats.asistencia_acumulada || 0;
    document.getElementById('metricPromedio').textContent = stats.promedio_asistencia || 0;
    document.getElementById('metricVisitas').textContent = stats.total_visitas || 0;

    const tbody = document.getElementById('tablaReportesBody');
    if (ultimos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No hay reportes de asistencia registrados todavía.</td></tr>';
      return;
    }

    tbody.innerHTML = ultimos.map(r => `
      <tr>
        <td>
          <strong>${r.culto_titulo}</strong><br>
          <span style="font-size: 0.775rem; color: var(--text-muted);">📅 ${this.formatearFecha(r.culto_fecha)}</span>
        </td>
        <td><strong style="color: var(--primary); font-size: 1.1rem;">${r.asistencia_total}</strong></td>
        <td>Adultos, niños y visitas computados</td>
        <td>-</td>
        <td>${r.novedades_incidencias || '<span style="color: var(--text-muted);">Sin novedades</span>'}</td>
        <td>Servidor Asignado</td>
      </tr>
    `).join('');

    this.dibujarGraficoAsistencias(ultimos);
  },

  // Modal Reporte
  async abrirModalReporte(cultoId, cultoTitulo) {
    document.getElementById('formReporte').reset();
    document.getElementById('reporteCultoId').value = cultoId;
    document.getElementById('reporteCultoInfo').textContent = `Culto: ${cultoTitulo}`;

    // Cargar si ya existía reporte
    const res = await this.apiFetch(`/api/reportes/culto/${cultoId}`);
    if (res && res.data) {
      document.getElementById('reporteHermanos').value = res.data.asistencia_hermanos || 0;
      document.getElementById('reporteNinos').value = res.data.asistencia_ninos || 0;
      document.getElementById('reporteVisitas').value = res.data.visitas_primeravez || 0;
      document.getElementById('reporteOfrenda').value = res.data.ofrenda_monto || 0;
      document.getElementById('reporteNovedades').value = res.data.novedades_incidencias || '';
    }

    this.abrirModal('modalReporte');
  },

  async guardarReporte(e) {
    e.preventDefault();
    const payload = {
      culto_id: Number(document.getElementById('reporteCultoId').value),
      asistencia_hermanos: document.getElementById('reporteHermanos').value,
      asistencia_ninos: document.getElementById('reporteNinos').value,
      visitas_primeravez: document.getElementById('reporteVisitas').value,
      ofrenda_monto: document.getElementById('reporteOfrenda').value,
      novedades_incidencias: document.getElementById('reporteNovedades').value
    };

    const res = await this.apiFetch('/api/reportes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.ok) {
      this.mostrarToast(`Reporte guardado. Total Asistentes: ${res.data.asistencia_total}`, 'success');
      this.cerrarModal('modalReporte');
      this.cargarReportes();
      this.cargarCultos();
    }
  },

  // 4. CARGAR USUARIOS Y EQUIPO
  async cargarUsuarios() {
    const tbody = document.getElementById('tablaUsuariosBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Cargando directorio...</td></tr>';

    const res = await this.apiFetch('/api/usuarios');
    if (!res || !res.ok) return;

    const esAdmin = this.usuario.rol === 'root' || this.usuario.rol === 'lider';
    const thAcciones = document.getElementById('thAccionesUsuario');
    if (thAcciones) thAcciones.style.display = esAdmin ? 'table-cell' : 'none';

    tbody.innerHTML = res.data.map(u => {
      const telLimpio = u.telefono ? u.telefono.replace(/\D/g, '') : null;
      return `
        <tr>
          <td>
            <strong>${u.nombre_completo}</strong>
            ${u.email ? `<br><span style="font-size: 0.775rem; color: var(--text-muted);">${u.email}</span>` : ''}
          </td>
          <td><code>${u.username || '-'}</code></td>
          <td>
            ${u.telefono ? `
              <a href="https://wa.me/${telLimpio}" target="_blank" style="text-decoration: none; color: #047857; font-weight: 600;">
                💬 ${u.telefono}
              </a>
            ` : '<span style="color: var(--text-muted);">Sin número</span>'}
          </td>
          <td>
            <span class="role-pill role-${u.rol}">${u.rol}</span>
          </td>
          <td>
            <span class="status-badge ${u.activo ? 'status-confirmado' : 'status-excusado'}">
              ${u.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          ${esAdmin ? `
            <td>
              <button class="btn btn-secondary btn-sm" onclick="App.toggleActivoUsuario(${u.id})">
                ${u.activo ? 'Desactivar' : 'Activar'}
              </button>
            </td>
          ` : ''}
        </tr>
      `;
    }).join('');
  },

  abrirModalUsuario() {
    document.getElementById('formUsuario').reset();
    document.getElementById('usuarioId').value = '';
    document.getElementById('modalUsuarioTitulo').textContent = 'Registrar Diácono / Servidor';
    document.getElementById('usuarioRol').value = 'diacono';
    document.getElementById('grupoPassword').style.display = 'block';
    this.abrirModal('modalUsuario');
  },

  async guardarUsuario(e) {
    e.preventDefault();
    const payload = {
      nombre_completo: document.getElementById('usuarioNombre').value,
      username: document.getElementById('usuarioUsername').value,
      telefono: document.getElementById('usuarioTelefono').value,
      email: document.getElementById('usuarioEmail').value || null,
      rol: document.getElementById('usuarioRol').value,
      password: document.getElementById('usuarioPassword').value || 'Diacono123*'
    };

    const res = await this.apiFetch('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.ok) {
      this.mostrarToast(`Diácono [${payload.nombre_completo}] registrado con éxito`, 'success');
      this.cerrarModal('modalUsuario');
      this.cargarUsuarios();
    }
  },

  async toggleActivoUsuario(id) {
    const res = await this.apiFetch(`/api/usuarios/${id}/toggle-activo`, { method: 'PATCH' });
    if (res && res.ok) {
      this.mostrarToast(res.mensaje, 'info');
      this.cargarUsuarios();
    }
  },

  // 5. CARGAR PUESTOS DE SERVICIO
  async cargarPuestos() {
    const tbody = document.getElementById('tablaPuestosBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Cargando puestos...</td></tr>';

    const res = await this.apiFetch('/api/puestos');
    if (!res || !res.ok) return;

    tbody.innerHTML = res.data.map(p => `
      <tr>
        <td><strong>#${p.orden}</strong></td>
        <td><strong style="color: var(--primary);">${p.nombre}</strong></td>
        <td style="font-size: 0.825rem; color: var(--text-muted);">${p.descripcion || '-'}</td>
        <td>${p.cupo_sugerido} personas</td>
        <td>
          <span class="status-badge ${p.activo ? 'status-confirmado' : 'status-excusado'}">
            ${p.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="App.eliminarPuesto(${p.id})">Desactivar</button>
        </td>
      </tr>
    `).join('');
  },

  abrirModalPuesto() {
    document.getElementById('formPuesto').reset();
    document.getElementById('puestoId').value = '';
    this.abrirModal('modalPuesto');
  },

  async guardarPuesto(e) {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById('puestoNombre').value,
      cupo_sugerido: Number(document.getElementById('puestoCupo').value),
      orden: Number(document.getElementById('puestoOrden').value),
      descripcion: document.getElementById('puestoDescripcion').value
    };

    const res = await this.apiFetch('/api/puestos', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.ok) {
      this.mostrarToast('Puesto de servicio creado', 'success');
      this.cerrarModal('modalPuesto');
      this.cargarPuestos();
    }
  },

  async eliminarPuesto(id) {
    if (!confirm('¿Deseas desactivar o eliminar este puesto?')) return;
    const res = await this.apiFetch(`/api/puestos/${id}`, { method: 'DELETE' });
    if (res && res.ok) {
      this.mostrarToast(res.mensaje || 'Puesto actualizado', 'info');
      this.cargarPuestos();
    }
  },

  // 6. CARGAR AUDITORÍA (SSD)
  async cargarAuditoria() {
    const tbody = document.getElementById('tablaAuditoriaBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Consultando bitácora de auditoría...</td></tr>';

    const res = await this.apiFetch('/api/auditoria');
    if (!res || !res.ok) return;

    if (res.data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Bitácora vacía.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.logs.map(log => `
      <tr>
        <td style="font-size: 0.775rem; white-space: nowrap;">${log.fecha}</td>
        <td><strong>${log.username || 'SISTEMA'}</strong></td>
        <td><span class="role-pill role-diacono">${log.modulo}</span></td>
        <td><code>${log.accion}</code></td>
        <td style="font-size: 0.8rem;">${log.detalle || '-'}</td>
        <td style="font-size: 0.75rem; color: var(--text-muted);">${log.ip || '-'}</td>
      </tr>
    `).join('');
  },

  // Cambio de contraseña
  async handleCambiarClave(e) {
    e.preventDefault();
    const password_actual = document.getElementById('claveActual').value;
    const password_nueva = document.getElementById('claveNueva').value;

    const res = await this.apiFetch('/api/auth/cambiar-password', {
      method: 'POST',
      body: JSON.stringify({ password_actual, password_nueva })
    });

    if (res && res.ok) {
      this.mostrarToast('Contraseña actualizada con éxito', 'success');
      this.cerrarModal('modalCambiarClave');
      document.getElementById('formCambiarClave').reset();
    }
  },

  // 7. MÉTODOS DE WHATSAPP E IMPRESIÓN
  async copiarCuadranteWhatsApp(cultoId) {
    const res = await this.apiFetch(`/api/cultos/${cultoId}`);
    if (!res || !res.ok) return;

    const { culto, turnos } = res.data;
    const fechaFmt = this.formatearFecha(culto.fecha);

    let texto = `🕊️ *CRONOGRAMA DE DIÁCONOS Y SERVIDORES* 🕊️\n`;
    texto += `⛪ *${culto.titulo}*\n`;
    texto += `📅 *Fecha:* ${fechaFmt}\n`;
    texto += `⏰ *Hora:* ${culto.hora_inicio}${culto.hora_fin ? ' - ' + culto.hora_fin : ''}\n\n`;
    texto += `📋 *ASIGNACIONES POR PUESTO:*\n`;

    if (turnos.length === 0) {
      texto += `_Sin asignaciones registradas aún._\n`;
    } else {
      turnos.forEach(t => {
        const estadoEmoji = t.estado_asistencia === 'confirmado' ? '✅' : (t.estado_asistencia === 'excusado' ? '❌ Excusado' : '⏳ Pendiente');
        texto += `• *${t.puesto_nombre}:* ${t.nombre_completo} (${estadoEmoji})\n`;
      });
    }

    texto += `\n🙏 _"Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres." (Col. 3:23)_\n`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
      this.mostrarToast('¡Cronograma copiado al portapapeles! Listo para pegar en WhatsApp', 'success');
    } else {
      prompt('Copia el texto para WhatsApp:', texto);
    }
  },

  recordarPorWhatsApp(telefono, nombre, puesto, cultoTitulo, fecha, hora) {
    if (!telefono) {
      this.mostrarToast('El diácono no tiene registrado un número telefónico', 'error');
      return;
    }
    const telLimpio = telefono.replace(/\D/g, '');
    const fechaFmt = this.formatearFecha(fecha);
    const mensaje = `Hola hermano/a *${nombre}*, bendiciones. Te recordamos tu asignación como diácono en el puesto *${puesto}* para el *${cultoTitulo}* (📅 ${fechaFmt} a las ⏰ ${hora}). Por favor confirma tu asistencia en el sistema. ¡Gracias por tu servicio al Señor!`;
    const url = `https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  },

  async imprimirCuadrante(cultoId) {
    const contenedor = document.getElementById(`detalle-turnos-${cultoId}`);
    if (contenedor && contenedor.style.display !== 'block') {
      await this.verDetalleCulto(cultoId);
    }
    window.print();
  },

  // 8. TABLÓN DE AVISOS
  async cargarAvisos() {
    const container = document.getElementById('avisosContainer');
    container.innerHTML = '<p style="color: var(--text-muted);">Cargando comunicados...</p>';

    const res = await this.apiFetch('/api/avisos');
    if (!res || !res.ok) return;

    const esAdmin = this.usuario.rol === 'root' || this.usuario.rol === 'lider';

    if (res.data.length === 0) {
      container.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
          <p style="color: var(--text-muted); font-size: 1rem;">📢 No hay comunicados ni avisos publicados por el momento.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = res.data.map(a => `
      <div class="card aviso-card aviso-${a.tipo}">
        <div class="card-header">
          <div>
            <div class="card-title">${a.titulo}</div>
            <div class="card-subtitle">
              Publicado por <strong>${a.autor_nombre || 'Liderazgo'}</strong> • ${this.formatearFecha(a.created_at ? a.created_at.split(' ')[0] : '')}
            </div>
          </div>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            ${a.fijado ? '<span class="badge-fijado">📌 FIJADO</span>' : ''}
            <span class="role-pill role-${a.tipo === 'urgente' ? 'root' : (a.tipo === 'importante' ? 'lider' : 'diacono')}">
              ${a.tipo.toUpperCase()}
            </span>
          </div>
        </div>

        <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-main); white-space: pre-line;">${a.contenido}</p>

        ${esAdmin ? `
          <div style="margin-top: auto; display: flex; justify-content: flex-end;">
            <button class="btn btn-danger btn-sm" onclick="App.eliminarAviso(${a.id})">Eliminar Comunicado</button>
          </div>
        ` : ''}
      </div>
    `).join('');
  },

  abrirModalAviso() {
    document.getElementById('formAviso').reset();
    this.abrirModal('modalAviso');
  },

  async guardarAviso(e) {
    e.preventDefault();
    const payload = {
      titulo: document.getElementById('avisoTitulo').value,
      tipo: document.getElementById('avisoTipo').value,
      fijado: document.getElementById('avisoFijado').checked ? 1 : 0,
      contenido: document.getElementById('avisoContenido').value
    };

    const res = await this.apiFetch('/api/avisos', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.ok) {
      this.mostrarToast('Comunicado publicado para todo el equipo', 'success');
      this.cerrarModal('modalAviso');
      this.cargarAvisos();
    }
  },

  async eliminarAviso(id) {
    if (!confirm('¿Deseas eliminar este comunicado?')) return;
    const res = await this.apiFetch(`/api/avisos/${id}`, { method: 'DELETE' });
    if (res && res.ok) {
      this.mostrarToast('Aviso eliminado', 'info');
      this.cargarAvisos();
    }
  },

  // 9. DISPONIBILIDAD DE SERVICIO
  async cargarDisponibilidad() {
    const tbody = document.getElementById('tablaDisponibilidadBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Consultando fechas...</td></tr>';

    const res = await this.apiFetch('/api/disponibilidad');
    if (!res || !res.ok) return;

    const esAdmin = this.usuario.rol === 'root' || this.usuario.rol === 'lider';
    const thDiac = document.getElementById('thDisponibilidadDiacono');
    if (thDiac) thDiac.style.display = esAdmin ? 'table-cell' : 'none';

    if (res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hay ausencias o indisponibilidades registradas.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(d => `
      <tr>
        <td><strong>📅 ${this.formatearFecha(d.fecha)}</strong></td>
        ${esAdmin ? `<td><strong>${d.nombre_completo || '-'}</strong></td>` : ''}
        <td>${d.motivo || 'No disponible'}</td>
        <td style="font-size: 0.775rem; color: var(--text-muted);">${d.created_at}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="App.eliminarDisponibilidad(${d.id})">Liberar Fecha</button>
        </td>
      </tr>
    `).join('');
  },

  abrirModalDisponibilidad() {
    document.getElementById('formDisponibilidad').reset();
    this.abrirModal('modalDisponibilidad');
  },

  async guardarDisponibilidad(e) {
    e.preventDefault();
    const payload = {
      fecha: document.getElementById('dispFecha').value,
      motivo: document.getElementById('dispMotivo').value
    };

    const res = await this.apiFetch('/api/disponibilidad', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.ok) {
      this.mostrarToast('Indisponibilidad guardada. El liderazgo no te asignará en esa fecha.', 'success');
      this.cerrarModal('modalDisponibilidad');
      this.cargarDisponibilidad();
    }
  },

  async eliminarDisponibilidad(id) {
    if (!confirm('¿Deseas eliminar este registro de ausencia y quedar disponible?')) return;
    const res = await this.apiFetch(`/api/disponibilidad/${id}`, { method: 'DELETE' });
    if (res && res.ok) {
      this.mostrarToast(res.mensaje, 'info');
      this.cargarDisponibilidad();
    }
  },

  // 10. GRÁFICO DE ASISTENCIAS EN CANVAS
  dibujarGraficoAsistencias(ultimos) {
    const canvas = document.getElementById('canvasGraficoAsistencia');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth - 40;
    canvas.width = Math.max(300, width);
    canvas.height = 160;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!ultimos || ultimos.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Aún no hay suficientes cultos registrados para mostrar gráfico.', canvas.width / 2, canvas.height / 2);
      return;
    }

    const items = [...ultimos].reverse();
    const maxVal = Math.max(...items.map(i => i.asistencia_total || 0), 10);
    const paddingLeft = 40;
    const paddingBottom = 30;
    const chartWidth = canvas.width - paddingLeft - 20;
    const chartHeight = canvas.height - paddingBottom - 20;

    const barWidth = Math.min(50, Math.floor(chartWidth / items.length) - 15);
    const step = chartWidth / items.length;

    // Líneas guía
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = 15 + (chartHeight / 3) * i;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(canvas.width - 20, y);
      ctx.stroke();

      const val = Math.round(maxVal - (maxVal / 3) * i);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val, paddingLeft - 8, y + 3);
    }

    // Barras
    items.forEach((item, idx) => {
      const x = paddingLeft + (idx * step) + (step - barWidth) / 2;
      const h = ((item.asistencia_total || 0) / maxVal) * chartHeight;
      const y = canvas.height - paddingBottom - h;

      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, '#1e3a8a');
      grad.addColorStop(1, '#0d9488');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, h, [4, 4, 0, 0]);
      ctx.fill();

      // Número total encima de la barra
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.asistencia_total, x + barWidth / 2, y - 5);

      // Fecha abajo
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      const label = item.culto_fecha ? item.culto_fecha.substring(5) : `C${idx + 1}`;
      ctx.fillText(label, x + barWidth / 2, canvas.height - paddingBottom + 15);
    });
  },

  // Helpers de Modales y Utilidades
  abrirModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  },

  cerrarModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  },

  mostrarToast(mensaje, tipo = 'info') {
    const contenedor = document.getElementById('toastContainer');
    if (!contenedor) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensaje;
    contenedor.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  formatearFecha(fechaStr) {
    if (!fechaStr) return '';
    try {
      const [y, m, d] = fechaStr.split('-');
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return `${d} ${meses[parseInt(m) - 1]} ${y}`;
    } catch {
      return fechaStr;
    }
  }
};

// Arrancar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => App.init());
