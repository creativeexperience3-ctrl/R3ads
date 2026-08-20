/* ============================================================
   R3ADS · Panel de intakes
   Login con Google + lista y detalle de /intakes.
   El control de acceso real vive en firestore.rules: esconder la
   interfaz no protege nada, solo evita mostrar un panel inservible.
   ============================================================ */

const ESTADOS = {
  nuevo:      { texto: 'Nuevo',      clase: 'estado-nuevo' },
  contactado: { texto: 'Contactado', clase: 'estado-contactado' },
  cerrado:    { texto: 'Cerrado',    clase: 'estado-cerrado' },
  descartado: { texto: 'Descartado', clase: 'estado-descartado' }
};

const vistaCargando = document.getElementById('vistaCargando');
const vistaLista   = document.getElementById('vistaLista');
const vistaDetalle = document.getElementById('vistaDetalle');
const listaEl      = document.getElementById('lista');
const listaEstado  = document.getElementById('listaEstado');
const adminUsuario = document.getElementById('adminUsuario');
const btnSalir     = document.getElementById('btnSalir');
const buscador     = document.getElementById('buscador');

let intakes = [];
let filtroEstado = 'todos';
let intakeAbierto = null;

/* ---------- Utilidades ---------- */
function mostrarVista(cual) {
  vistaCargando.hidden = cual !== 'cargando';
  vistaLista.hidden    = cual !== 'lista';
  vistaDetalle.hidden  = cual !== 'detalle';
}

function fechaDe(intake) {
  return intake.creado && intake.creado.toDate ? intake.creado.toDate() : null;
}

function fechaCorta(d) {
  if (!d) return 'Sin fecha';
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
}

/* ---------- Sesión ----------
   Esta página asume que ya hay sesión: quien no la tenga vuelve a
   login.html, que es el único punto de entrada. */
if (!window.r3Configurado || !window.r3Auth) {
  vistaCargando.textContent =
    'Firebase todavía no está configurado. Falta la config del proyecto en firebase-init.js.';
} else {
  btnSalir.addEventListener('click', async () => {
    await window.r3Auth.signOut();
    location.replace('login.html');
  });

  window.r3Auth.onAuthStateChanged(async (user) => {
    if (!user) {
      location.replace('login.html');
      return;
    }
    if (!window.R3_ADMINS.includes(user.email)) {
      await window.r3Auth.signOut();
      location.replace('login.html?e=acceso');
      return;
    }
    adminUsuario.textContent = user.email;
    adminUsuario.hidden = false;
    btnSalir.hidden = false;
    mostrarVista('lista');
    escucharIntakes();
  });
}

/* ---------- Lista ---------- */
let desuscribir = null;

function escucharIntakes() {
  if (desuscribir) return;
  desuscribir = window.r3Db.collection('intakes')
    .orderBy('creado', 'desc')
    .limit(300)
    .onSnapshot(
      (snap) => {
        intakes = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        pintarLista();
      },
      (err) => {
        console.error(err);
        listaEstado.textContent = 'No se pudieron cargar los intakes: ' + (err.message || err.code);
        listaEstado.hidden = false;
      }
    );
}

function intakesVisibles() {
  const q = buscador.value.trim().toLowerCase();
  return intakes.filter((i) => {
    if (filtroEstado !== 'todos' && (i.estado || 'nuevo') !== filtroEstado) return false;
    if (!q) return true;
    return [i.empresa, i.nombre, i.telPersona, i.telEmpresa, i.instagram]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  });
}

function pintarLista() {
  const visibles = intakesVisibles();

  if (!intakes.length) {
    listaEstado.textContent = 'Todavía no llegó ningún intake.';
    listaEstado.hidden = false;
    listaEl.innerHTML = '';
    return;
  }
  if (!visibles.length) {
    listaEstado.textContent = 'Ningún intake coincide con ese filtro.';
    listaEstado.hidden = false;
    listaEl.innerHTML = '';
    return;
  }

  const nuevos = intakes.filter((i) => (i.estado || 'nuevo') === 'nuevo').length;
  listaEstado.textContent = `${intakes.length} intake${intakes.length === 1 ? '' : 's'} · ${nuevos} sin contactar`;
  listaEstado.hidden = false;

  listaEl.innerHTML = visibles.map((i) => {
    const est = ESTADOS[i.estado] || ESTADOS.nuevo;
    return `<button type="button" class="admin-item" data-id="${R3Intake.esc(i.id)}">
      <span class="admin-item-top">
        <span class="admin-item-empresa">${R3Intake.esc(i.empresa || 'Sin empresa')}</span>
        <span class="admin-estado-chip ${est.clase}">${est.texto}</span>
      </span>
      <span class="admin-item-meta">${R3Intake.esc(i.nombre || '')} · ${R3Intake.esc(i.telPersona || '')}</span>
      <span class="admin-item-fecha">${R3Intake.esc(fechaCorta(fechaDe(i)))}</span>
    </button>`;
  }).join('');
}

listaEl.addEventListener('click', (e) => {
  const item = e.target.closest('.admin-item');
  if (item) abrirDetalle(item.dataset.id);
});

document.getElementById('filtros').addEventListener('click', (e) => {
  const chip = e.target.closest('.admin-chip');
  if (!chip) return;
  filtroEstado = chip.dataset.estado;
  document.querySelectorAll('.admin-chip').forEach((c) => c.classList.toggle('is-activo', c === chip));
  pintarLista();
});

buscador.addEventListener('input', pintarLista);

/* ---------- Detalle ---------- */
function abrirDetalle(id) {
  intakeAbierto = intakes.find((i) => i.id === id);
  if (!intakeAbierto) return;

  const i = intakeAbierto;
  document.getElementById('detalleDoc').innerHTML =
    R3Intake.docHTML(i.secciones, i.empresa, fechaDe(i));

  document.getElementById('selEstado').value = i.estado || 'nuevo';
  document.getElementById('txtNotas').value = i.notas || '';
  document.getElementById('guardadoAviso').hidden = true;

  document.getElementById('btnWaProspecto').href = R3Intake.waLink(
    i.telPersona,
    `Hola ${i.nombre || ''}, te escribimos de R3ADS. Recibimos el formulario de ${i.empresa || 'tu empresa'} y queremos agendar tu diagnóstico.`
  );

  mostrarVista('detalle');
  scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('btnVolver').addEventListener('click', () => {
  intakeAbierto = null;
  mostrarVista('lista');
});

document.getElementById('btnDescargarIntake').addEventListener('click', () => {
  if (!intakeAbierto) return;
  R3Intake.descargar(intakeAbierto.secciones, intakeAbierto.empresa, fechaDe(intakeAbierto));
});

document.getElementById('btnCopiarIntake').addEventListener('click', async (e) => {
  if (!intakeAbierto) return;
  const boton = e.currentTarget;
  const original = boton.textContent;
  await R3Intake.copiar(
    R3Intake.docTexto(intakeAbierto.secciones, intakeAbierto.empresa, fechaDe(intakeAbierto))
  );
  boton.textContent = 'Copiado';
  setTimeout(() => { boton.textContent = original; }, 2000);
});

document.getElementById('btnGuardarSeguimiento').addEventListener('click', async (e) => {
  if (!intakeAbierto) return;
  const boton = e.currentTarget;
  boton.disabled = true;
  try {
    await window.r3Db.collection('intakes').doc(intakeAbierto.id).update({
      estado: document.getElementById('selEstado').value,
      notas: document.getElementById('txtNotas').value.trim(),
      actualizado: firebase.firestore.FieldValue.serverTimestamp()
    });
    const aviso = document.getElementById('guardadoAviso');
    aviso.hidden = false;
    setTimeout(() => { aviso.hidden = true; }, 2500);
  } catch (err) {
    console.error(err);
    alert('No se pudo guardar: ' + (err.message || err.code));
  }
  boton.disabled = false;
});

document.getElementById('btnBorrarIntake').addEventListener('click', async () => {
  if (!intakeAbierto) return;
  const nombre = intakeAbierto.empresa || 'este intake';
  if (!confirm(`¿Eliminar definitivamente el intake de ${nombre}? No se puede deshacer.`)) return;
  try {
    await window.r3Db.collection('intakes').doc(intakeAbierto.id).delete();
    intakeAbierto = null;
    mostrarVista('lista');
  } catch (err) {
    console.error(err);
    alert('No se pudo eliminar: ' + (err.message || err.code));
  }
});
