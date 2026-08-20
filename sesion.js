/* ============================================================
   R3ADS · Sesión Cero — mesa de trabajo
   Se elige un intake, se corren los 8 módulos en vivo, se levantan
   hallazgos con los 8 campos de la anatomía, se destila al FODA con
   trazabilidad y se genera el reporte que se entrega al cliente.

   Todo se autoguarda en /sesiones/{id}. Durante una reunión de tres
   horas nadie se acuerda de guardar.
   ============================================================ */

const esc = window.R3Intake.esc;
const G = window.R3Guion;

const vistaCargando = document.getElementById('vistaCargando');
const vistaElegir   = document.getElementById('vistaElegir');
const vistaSesion   = document.getElementById('vistaSesion');
const guardadoEl    = document.getElementById('guardadoEstado');

let sesionId = null;
let sesion = null;     // documento vivo en memoria
let intake = null;     // el intake del cliente

/* ---------- Vistas ---------- */
function mostrarVista(cual) {
  vistaCargando.hidden = cual !== 'cargando';
  vistaElegir.hidden   = cual !== 'elegir';
  vistaSesion.hidden   = cual !== 'sesion';
}

/* ---------- Autoguardado ----------
   Se espera a que pare de escribir antes de mandar a Firestore, para
   no disparar una escritura por tecla en una sesión de tres horas. */
let guardarTimer = null;
let guardando = false;

function marcarCambio() {
  guardadoEl.textContent = 'Sin guardar…';
  clearTimeout(guardarTimer);
  guardarTimer = setTimeout(guardar, 900);
}

async function guardar() {
  if (!sesionId || guardando) return;
  guardando = true;
  guardadoEl.textContent = 'Guardando…';
  try {
    await window.r3Db.collection('sesiones').doc(sesionId).set(
      Object.assign({}, sesion, {
        actualizado: firebase.firestore.FieldValue.serverTimestamp()
      }),
      { merge: true }
    );
    // 'creado' se manda una sola vez. Si el sentinela de serverTimestamp
    // se quedara en memoria, cada autoguardado correría la fecha de
    // creación hacia adelante.
    delete sesion.creado;
    guardadoEl.textContent = 'Guardado ' + new Date().toLocaleTimeString('es-HN',
      { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    console.error('[R3ADS] No se pudo guardar la sesión:', err);
    guardadoEl.textContent = 'Error al guardar';
  }
  guardando = false;
}

// Si se cierra la pestaña con cambios pendientes, avisar.
window.addEventListener('beforeunload', (e) => {
  if (guardadoEl.textContent === 'Sin guardar…') { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- Elegir intake ---------- */
async function cargarIntakes() {
  const estado = document.getElementById('elegirEstado');
  try {
    const snap = await window.r3Db.collection('intakes')
      .orderBy('creado', 'desc').limit(200).get();
    const docs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

    if (!docs.length) {
      estado.textContent = 'Todavía no llegó ningún intake. La sesión arranca desde el formulario del cliente.';
      return;
    }
    estado.textContent = `${docs.length} intake${docs.length === 1 ? '' : 's'} disponible${docs.length === 1 ? '' : 's'}`;

    document.getElementById('listaIntakes').innerHTML = docs.map((i) => {
      const f = i.creado && i.creado.toDate ? i.creado.toDate() : null;
      return `<button type="button" class="admin-item" data-id="${esc(i.id)}">
        <span class="admin-item-top">
          <span class="admin-item-empresa">${esc(i.empresa || 'Sin empresa')}</span>
        </span>
        <span class="admin-item-meta">${esc(i.nombre || '')} · ${esc(i.telPersona || '')}</span>
        <span class="admin-item-fecha">${esc(f ? f.toLocaleDateString('es-HN',
          { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha')}</span>
      </button>`;
    }).join('');
  } catch (err) {
    console.error(err);
    estado.textContent = 'No se pudieron cargar los intakes: ' + (err.message || err.code);
  }
}

document.getElementById('listaIntakes').addEventListener('click', (e) => {
  const item = e.target.closest('.admin-item');
  if (item) location.href = 'sesion.html?intake=' + encodeURIComponent(item.dataset.id);
});

/* ---------- Abrir o crear la sesión de un intake ---------- */
async function abrirSesion(intakeId) {
  const snapIntake = await window.r3Db.collection('intakes').doc(intakeId).get();
  if (!snapIntake.exists) {
    vistaCargando.textContent = 'Ese intake ya no existe.';
    mostrarVista('cargando');
    return;
  }
  intake = Object.assign({ id: snapIntake.id }, snapIntake.data());

  // Una sesión por intake: si ya existe se retoma, no se duplica.
  const previas = await window.r3Db.collection('sesiones')
    .where('intakeId', '==', intakeId).limit(1).get();

  if (!previas.empty) {
    sesionId = previas.docs[0].id;
    sesion = previas.docs[0].data();
  } else {
    sesionId = window.r3Db.collection('sesiones').doc().id;
    sesion = {
      intakeId,
      empresa: intake.empresa || '',
      contacto: intake.nombre || '',
      telefono: intake.telPersona || '',
      fechaSesion: new Date().toISOString().slice(0, 10),
      notas: {},
      hallazgos: [],
      foda: { F: [], D: [], O: [], A: [] },
      gatesManuales: {},
      creado: firebase.firestore.FieldValue.serverTimestamp()
    };
    await guardar();
  }

  // Compatibilidad con sesiones guardadas antes de algún campo nuevo.
  sesion.notas = sesion.notas || {};
  sesion.hallazgos = sesion.hallazgos || [];
  sesion.foda = Object.assign({ F: [], D: [], O: [], A: [] }, sesion.foda || {});
  sesion.gatesManuales = sesion.gatesManuales || {};

  pintarTodo();
  mostrarVista('sesion');
}

/* ---------- Pintado ---------- */
function pintarTodo() {
  document.getElementById('sesEmpresa').textContent = sesion.empresa || 'Sin empresa';
  document.getElementById('sesMeta').textContent =
    [sesion.contacto, sesion.telefono].filter(Boolean).join(' · ');
  document.getElementById('sesFecha').value = sesion.fechaSesion || '';
  document.getElementById('insumosTexto').textContent = G.insumosPrevios;

  pintarModulos();
  pintarHallazgos();
  pintarFoda();
  pintarIntake();
}

/* --- Módulos --- */
function pintarModulos() {
  document.getElementById('modulos').innerHTML = G.modulos.map((m) => `
    <section class="ses-modulo">
      <header class="ses-mhead">
        <span class="ses-code">${m.id}</span>
        <h3>${esc(m.titulo)}</h3>
        <span class="ses-dur">${esc(m.duracion)}</span>
      </header>
      <div class="ses-mbody">
        ${m.nota ? `<p class="ses-mnota">${esc(m.nota)}</p>` : ''}
        <ol class="ses-preguntas">
          ${m.preguntas.map((p, i) => `<li>
            <p class="ses-q">${esc(p.q)}</p>
            ${p.why ? `<p class="ses-why">${esc(p.why)}</p>` : ''}
            <textarea class="ses-nota" data-nota="${m.id}-${i}" rows="2"
              placeholder="Qué respondió, textual">${esc(sesion.notas[m.id + '-' + i] || '')}</textarea>
            <button type="button" class="ses-a-hallazgo" data-modulo="${m.id}" data-nota="${m.id}-${i}">
              Convertir en hallazgo →
            </button>
          </li>`).join('')}
        </ol>
        <p class="ses-salida"><b>Salida:</b> ${esc(m.salida)}</p>
      </div>
    </section>`).join('');
}

document.getElementById('modulos').addEventListener('input', (e) => {
  if (!e.target.dataset.nota) return;
  sesion.notas[e.target.dataset.nota] = e.target.value;
  marcarCambio();
});

document.getElementById('modulos').addEventListener('click', (e) => {
  const btn = e.target.closest('.ses-a-hallazgo');
  if (!btn) return;
  const evidencia = sesion.notas[btn.dataset.nota] || '';
  nuevoHallazgo({ modulo: btn.dataset.modulo, evidencia, fuente: 'Entrevista · Sesión Cero' });
  irAPanel('hallazgos');
});

/* --- Hallazgos --- */
function siguienteCodigo() {
  const nums = sesion.hallazgos
    .map((h) => parseInt(String(h.codigo).replace(/\D/g, ''), 10))
    .filter((n) => !isNaN(n));
  const n = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
  return 'H-' + String(n).padStart(2, '0');
}

function nuevoHallazgo(pre) {
  sesion.hallazgos.push(Object.assign({
    codigo: siguienteCodigo(),
    titulo: '',
    clase: 'dato',
    modulo: '',
    fuente: '',
    evidencia: '',
    tension: '',
    implicacion: '',
    alimenta: '',
    verificacion: '',
    noObvio: false     // control G1: el dueño no pudo haberlo escrito solo
  }, pre || {}));
  marcarCambio();
  pintarHallazgos();
}

const CAMPOS_HALLAZGO = [
  ['modulo', 'Módulo', 'M1 a M8', 'input'],
  ['fuente', 'Fuente', 'Entrevista · observación · documento · plataforma, con fecha o archivo', 'input'],
  ['evidencia', 'Evidencia', 'La cita textual, el número o la captura. Sin interpretar.', 'textarea'],
  ['tension', 'Tensión', 'Contra qué choca. Obligatorio: sin tensión es inventario.', 'textarea'],
  ['implicacion', 'Implicación', 'Qué cambia en el negocio si esto es cierto. Una frase, en presente.', 'textarea'],
  ['alimenta', 'Alimenta', '→ F1 / D2 / O3 / A1', 'input'],
  ['verificacion', 'Verificación', 'Cómo se comprueba y en cuánto tiempo.', 'textarea']
];

function pintarHallazgos() {
  document.getElementById('numHallazgos').textContent = sesion.hallazgos.length;

  document.getElementById('hallazgos').innerHTML = sesion.hallazgos.map((h, idx) => `
    <article class="ses-ficha ses-ficha--${esc(h.clase)}" data-idx="${idx}">
      <header class="ses-fhead">
        <span class="ses-code">${esc(h.codigo)}</span>
        <input type="text" class="ses-titulo" data-campo="titulo" value="${esc(h.titulo)}"
          placeholder="Título en una línea: el hecho, nunca la opinión">
        <select class="ses-clase" data-campo="clase">
          ${Object.entries(G.clases).map(([k, v]) =>
            `<option value="${k}"${h.clase === k ? ' selected' : ''}>${esc(v.texto)}</option>`).join('')}
        </select>
        <button type="button" class="ses-borrar" title="Eliminar hallazgo">✕</button>
      </header>
      <div class="ses-fbody">
        ${CAMPOS_HALLAZGO.map(([k, label, ph, tipo]) => `
          <div class="ses-campo${k === 'tension' && !h.tension ? ' ses-campo--falta' : ''}">
            <label>${esc(label)}</label>
            ${tipo === 'textarea'
              ? `<textarea data-campo="${k}" rows="2" placeholder="${esc(ph)}">${esc(h[k] || '')}</textarea>`
              : `<input type="text" data-campo="${k}" value="${esc(h[k] || '')}" placeholder="${esc(ph)}">`}
          </div>`).join('')}
        <label class="ses-check">
          <input type="checkbox" data-campo="noObvio"${h.noObvio ? ' checked' : ''}>
          <span>El dueño no pudo haber escrito esto solo</span>
        </label>
      </div>
    </article>`).join('') ||
    '<p class="ses-vacio">Todavía no hay hallazgos. Levantalos desde los módulos o creá uno en blanco.</p>';

  pintarGates();
}

const hallazgosEl = document.getElementById('hallazgos');

hallazgosEl.addEventListener('input', (e) => {
  const ficha = e.target.closest('.ses-ficha');
  const campo = e.target.dataset.campo;
  if (!ficha || !campo) return;
  const h = sesion.hallazgos[+ficha.dataset.idx];
  h[campo] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (campo === 'tension') {
    e.target.closest('.ses-campo').classList.toggle('ses-campo--falta', !e.target.value.trim());
  }
  marcarCambio();
  pintarGates();
});

hallazgosEl.addEventListener('change', (e) => {
  const ficha = e.target.closest('.ses-ficha');
  if (!ficha) return;
  if (e.target.dataset.campo === 'clase') {
    sesion.hallazgos[+ficha.dataset.idx].clase = e.target.value;
    ficha.className = 'ses-ficha ses-ficha--' + e.target.value;
    marcarCambio();
    pintarGates();
  } else if (e.target.dataset.campo === 'noObvio') {
    sesion.hallazgos[+ficha.dataset.idx].noObvio = e.target.checked;
    marcarCambio();
    pintarGates();
  }
});

hallazgosEl.addEventListener('click', (e) => {
  if (!e.target.closest('.ses-borrar')) return;
  const ficha = e.target.closest('.ses-ficha');
  const h = sesion.hallazgos[+ficha.dataset.idx];
  if (!confirm(`¿Eliminar ${h.codigo}? No se puede deshacer.`)) return;
  sesion.hallazgos.splice(+ficha.dataset.idx, 1);
  marcarCambio();
  pintarHallazgos();
});

document.getElementById('btnNuevoHallazgo').addEventListener('click', () => nuevoHallazgo());

/* --- Controles de calidad (sección 06 del instrumento) --- */
function evaluarGates() {
  const h = sesion.hallazgos;
  const modulosConHallazgo = new Set(
    h.map((x) => String(x.modulo).toUpperCase().match(/M[1-8]/g) || []).flat()
  );
  const faltantes = G.modulos.map((m) => m.id).filter((id) => !modulosConHallazgo.has(id));
  const sinTension = h.filter((x) => !String(x.tension || '').trim());
  const sinVerif = h.filter((x) => x.clase !== 'dato' && !String(x.verificacion || '').trim());

  return {
    G1: { ok: h.filter((x) => x.noObvio).length >= 3,
          detalle: `${h.filter((x) => x.noObvio).length} de 3 marcados` },
    G2: { ok: h.length > 0 && !sinTension.length,
          detalle: sinTension.length ? `Falta en ${sinTension.map((x) => x.codigo).join(', ')}` : 'Todos con tensión' },
    G3: { ok: !faltantes.length,
          detalle: faltantes.length ? `Sin hallazgo: ${faltantes.join(', ')}` : 'Los 8 módulos cubiertos' },
    G4: { ok: !sinVerif.length,
          detalle: sinVerif.length ? `Falta en ${sinVerif.map((x) => x.codigo).join(', ')}` : 'Todas con método' }
  };
}

function pintarGates() {
  const auto = evaluarGates();
  document.getElementById('gates').innerHTML = `
    <p class="ses-eyebrow">Controles de calidad · antes de escribir el Documento 01</p>
    <ul class="ses-gates-lista">
      ${G.gates.map((g) => {
        if (g.auto) {
          const r = auto[g.id];
          return `<li class="${r.ok ? 'is-ok' : 'is-falta'}">
            <span class="ses-gate-id">${g.id}</span>
            <span class="ses-gate-texto">${esc(g.texto)}</span>
            <span class="ses-gate-detalle">${esc(r.detalle)}</span>
          </li>`;
        }
        const marcado = !!sesion.gatesManuales[g.id];
        return `<li class="${marcado ? 'is-ok' : ''}">
          <span class="ses-gate-id">${g.id}</span>
          <label class="ses-gate-texto ses-gate-manual">
            <input type="checkbox" data-gate="${g.id}"${marcado ? ' checked' : ''}>
            ${esc(g.texto)}
          </label>
          <span class="ses-gate-detalle">manual</span>
        </li>`;
      }).join('')}
    </ul>`;
}

document.getElementById('gates').addEventListener('change', (e) => {
  if (!e.target.dataset.gate) return;
  sesion.gatesManuales[e.target.dataset.gate] = e.target.checked;
  marcarCambio();
  pintarGates();
});

/* --- FODA --- */
function pintarFoda() {
  document.getElementById('reglasFoda').innerHTML = G.foda.map((c) =>
    `<div class="ses-regla"><span class="ses-regla-k">${esc(c.regla)}</span>
     <span class="ses-regla-v">→ ${esc(c.nombre)}</span></div>`).join('') +
    `<div class="ses-regla"><span class="ses-regla-k">Creencia · Punto ciego</span>
     <span class="ses-regla-v">→ Información pendiente, no al FODA</span></div>`;

  const codigos = sesion.hallazgos.map((h) => h.codigo);

  document.getElementById('foda').innerHTML = G.foda.map((cat) => {
    const entradas = sesion.foda[cat.id] || [];
    return `<section class="ses-foda-cat" data-cat="${cat.id}">
      <header class="ses-foda-head">
        <span class="ses-code">${cat.id}</span>
        <h3>${esc(cat.nombre)}</h3>
        <button type="button" class="ses-foda-add btn btn-outline btn-sm">Agregar</button>
      </header>
      ${entradas.map((e, i) => `
        <div class="ses-foda-item" data-idx="${i}">
          <span class="ses-foda-cod">${cat.id}${i + 1}</span>
          <textarea data-campo="texto" rows="2"
            placeholder="La entrada, en una frase">${esc(e.texto || '')}</textarea>
          <div class="ses-foda-traza">
            <label>Hallazgos que la sostienen</label>
            <div class="ses-traza-chips">
              ${codigos.length ? codigos.map((c) => `
                <label class="ses-chip${(e.hallazgos || []).includes(c) ? ' is-activo' : ''}">
                  <input type="checkbox" data-traza="${esc(c)}"${(e.hallazgos || []).includes(c) ? ' checked' : ''}>
                  ${esc(c)}
                </label>`).join('')
                : '<span class="ses-sin-codigos">Todavía no hay hallazgos que citar.</span>'}
            </div>
            ${!(e.hallazgos || []).length
              ? '<p class="ses-aviso-traza">Sin código, esto es una opinión del estudio: o se borra, o se convierte en hallazgo.</p>'
              : ''}
          </div>
          <button type="button" class="ses-borrar" title="Eliminar entrada">✕</button>
        </div>`).join('') || '<p class="ses-vacio">Sin entradas.</p>'}
    </section>`;
  }).join('');
}

const fodaEl = document.getElementById('foda');

fodaEl.addEventListener('click', (e) => {
  const cat = e.target.closest('.ses-foda-cat');
  if (!cat) return;
  if (e.target.closest('.ses-foda-add')) {
    sesion.foda[cat.dataset.cat].push({ texto: '', hallazgos: [] });
    marcarCambio();
    pintarFoda();
  } else if (e.target.closest('.ses-borrar')) {
    const item = e.target.closest('.ses-foda-item');
    sesion.foda[cat.dataset.cat].splice(+item.dataset.idx, 1);
    marcarCambio();
    pintarFoda();
  }
});

fodaEl.addEventListener('input', (e) => {
  if (e.target.dataset.campo !== 'texto') return;
  const cat = e.target.closest('.ses-foda-cat');
  const item = e.target.closest('.ses-foda-item');
  sesion.foda[cat.dataset.cat][+item.dataset.idx].texto = e.target.value;
  marcarCambio();
});

fodaEl.addEventListener('change', (e) => {
  if (!e.target.dataset.traza) return;
  const cat = e.target.closest('.ses-foda-cat');
  const item = e.target.closest('.ses-foda-item');
  const entrada = sesion.foda[cat.dataset.cat][+item.dataset.idx];
  entrada.hallazgos = entrada.hallazgos || [];
  const cod = e.target.dataset.traza;
  if (e.target.checked) {
    if (!entrada.hallazgos.includes(cod)) entrada.hallazgos.push(cod);
  } else {
    entrada.hallazgos = entrada.hallazgos.filter((c) => c !== cod);
  }
  marcarCambio();
  pintarFoda();
});

/* --- Intake del cliente --- */
function pintarIntake() {
  const f = intake.creado && intake.creado.toDate ? intake.creado.toDate() : null;
  document.getElementById('intakeDoc').innerHTML =
    window.R3Intake.docHTML(intake.secciones, intake.empresa, f);
}

/* --- Reporte --- */
function pintarReporte() {
  // Se previsualiza dentro de un iframe para que el CSS del reporte no
  // se mezcle con el de la mesa de trabajo: es exactamente el archivo
  // que se va a descargar, no una aproximación.
  const cont = document.getElementById('reporte');
  cont.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.className = 'ses-reporte-frame';
  iframe.srcdoc = window.R3Sesion.archivoHTML(sesion);
  cont.appendChild(iframe);

  document.getElementById('btnWaCliente').href = window.R3Intake.waLink(
    sesion.telefono,
    `Hola ${sesion.contacto || ''}, te comparto el reporte de la Sesión Cero de ${sesion.empresa || 'tu empresa'}. ` +
    `Ahí están los hallazgos con su evidencia y la destilación al FODA.`
  );
}

document.getElementById('btnDescargarReporte').addEventListener('click', () => {
  window.R3Sesion.descargar(sesion);
});

document.getElementById('btnCopiarReporte').addEventListener('click', async (e) => {
  const b = e.currentTarget, t = b.textContent;
  await window.R3Intake.copiar(window.R3Sesion.docTexto(sesion));
  b.textContent = 'Copiado';
  setTimeout(() => { b.textContent = t; }, 2000);
});

/* ---------- Tabs ---------- */
function irAPanel(nombre) {
  document.querySelectorAll('.ses-tab').forEach((t) =>
    t.classList.toggle('is-activo', t.dataset.panel === nombre));
  document.querySelectorAll('.ses-panel').forEach((p) =>
    p.hidden = p.id !== 'panel-' + nombre);
  if (nombre === 'reporte') pintarReporte();
  scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelector('.ses-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.ses-tab');
  if (tab) irAPanel(tab.dataset.panel);
});

document.getElementById('sesFecha').addEventListener('change', (e) => {
  sesion.fechaSesion = e.target.value;
  marcarCambio();
});

/* ---------- Arranque ---------- */
if (!window.r3Configurado || !window.r3Auth) {
  vistaCargando.textContent = 'Firebase todavía no está configurado.';
} else {
  window.r3Auth.onAuthStateChanged(async (user) => {
    if (!user) { location.replace('login.html'); return; }
    if (!window.R3_ADMINS.includes(user.email)) {
      await window.r3Auth.signOut();
      location.replace('login.html?e=acceso');
      return;
    }
    const intakeId = new URLSearchParams(location.search).get('intake');
    try {
      if (intakeId) {
        await abrirSesion(intakeId);
      } else {
        mostrarVista('elegir');
        cargarIntakes();
      }
    } catch (err) {
      console.error(err);
      vistaCargando.textContent = 'No se pudo abrir la sesión: ' + (err.message || err.code);
      mostrarVista('cargando');
    }
  });
}
