/* ============================================
   R3ADS · Formulario de intake
   Multi-paso + autoguardado + documento de intake
   ============================================ */

const WHATSAPP = '50495652894';
const STORAGE_KEY = 'r3ads_intake_v1';

const form = document.getElementById('intakeForm');
const pasos = Array.from(form.querySelectorAll('.form-step'));
const btnAtras = document.getElementById('btnAtras');
const btnSiguiente = document.getElementById('btnSiguiente');
const btnGenerar = document.getElementById('btnGenerar');
const formError = document.getElementById('formError');
const progresoBarra = document.getElementById('progresoBarra');
const progresoPaso = document.getElementById('progresoPaso');
const progresoTotal = document.getElementById('progresoTotal');
const resultado = document.getElementById('resultado');
const intakeDoc = document.getElementById('intakeDoc');
const formWrapSecciones = document.querySelector('.form-progreso');

let pasoActual = 0;

/* ---------- Navegación entre pasos ---------- */
function mostrarPaso(i) {
  pasoActual = Math.max(0, Math.min(i, pasos.length - 1));
  pasos.forEach((p, idx) => { p.hidden = idx !== pasoActual; });

  btnAtras.hidden = pasoActual === 0;
  btnSiguiente.hidden = pasoActual === pasos.length - 1;
  btnGenerar.hidden = pasoActual !== pasos.length - 1;

  progresoPaso.textContent = pasoActual + 1;
  progresoBarra.style.width = (((pasoActual + 1) / pasos.length) * 100) + '%';
  formError.hidden = true;
}

function validarPaso() {
  const requeridos = pasos[pasoActual].querySelectorAll('[required]');
  for (const campo of requeridos) {
    if (!campo.value.trim()) {
      formError.textContent = 'Completá los campos marcados con * para continuar.';
      formError.hidden = false;
      campo.focus();
      campo.classList.add('campo-invalido');
      return false;
    }
    campo.classList.remove('campo-invalido');
  }
  return true;
}

btnSiguiente.addEventListener('click', () => {
  if (!validarPaso()) return;
  mostrarPaso(pasoActual + 1);
  document.querySelector('.form-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

btnAtras.addEventListener('click', () => {
  mostrarPaso(pasoActual - 1);
  document.querySelector('.form-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

form.addEventListener('input', (e) => {
  e.target.classList.remove('campo-invalido');
  formError.hidden = true;
  guardar();
});
form.addEventListener('change', guardar);

/* ---------- Autoguardado en el navegador ---------- */
function guardar() {
  const datos = {};
  form.querySelectorAll('input, textarea').forEach((el) => {
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked) {
        if (el.type === 'checkbox') (datos[el.name] = datos[el.name] || []).push(el.value);
        else datos[el.name] = el.value;
      }
    } else if (el.value) {
      datos[el.name] = el.value;
    }
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(datos)); } catch (err) { /* modo privado */ }
}

function restaurar() {
  let datos;
  try { datos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (err) { return; }
  Object.entries(datos).forEach(([nombre, valor]) => {
    const campos = form.querySelectorAll(`[name="${CSS.escape(nombre)}"]`);
    campos.forEach((el) => {
      if (el.type === 'checkbox') el.checked = Array.isArray(valor) && valor.includes(el.value);
      else if (el.type === 'radio') el.checked = el.value === valor;
      else el.value = valor;
    });
  });
}

/* ---------- Recolección de respuestas ---------- */
function recolectar() {
  const secciones = [];
  pasos.forEach((fs) => {
    const campos = [];
    const grupos = new Set();
    fs.querySelectorAll('[data-label]').forEach((el) => {
      const label = el.dataset.label;
      if (el.type === 'radio' || el.type === 'checkbox') {
        if (grupos.has(el.name)) return;
        grupos.add(el.name);
        const marcados = Array.from(fs.querySelectorAll(`[name="${CSS.escape(el.name)}"]`))
          .filter((i) => i.checked)
          .map((i) => i.value);
        if (marcados.length) campos.push({ label, valores: marcados, lista: el.type === 'checkbox' });
      } else {
        const v = el.value.trim();
        if (v) campos.push({ label, valores: [v], lista: false });
      }
    });
    if (campos.length) secciones.push({ titulo: fs.dataset.titulo, campos });
  });
  return secciones;
}

function valorDe(nombre) {
  const el = form.querySelector(`[name="${CSS.escape(nombre)}"]`);
  return el ? el.value.trim() : '';
}

function empresaActual() {
  return valorDe('empresa');
}

/* ---------- Render del documento ----------
   La construccion del documento vive en intake-doc.js, compartida con
   el panel de administracion. Aca solo se le pasan los datos. */

/* ---------- Envío a Firestore ----------
   El envío es un extra, no un requisito: si Firebase no está configurado
   o la red falla, el cliente igual se lleva su documento por descarga y
   WhatsApp. Nunca se le bloquea el resultado por un error de backend. */
let huellaEnviada = null;

function estadoEnvio(clase, texto) {
  const el = document.getElementById('envioEstado');
  el.className = 'form-envio ' + clase;
  el.textContent = texto;
  el.hidden = false;
}

async function enviarAFirestore(secciones) {
  if (!window.r3Configurado || !window.r3Db) {
    estadoEnvio('form-envio-aviso',
      'Descargá el documento y enviánoslo por WhatsApp: el envío automático todavía no está activo.');
    return;
  }

  const huella = JSON.stringify(secciones);
  if (huellaEnviada === huella) {
    estadoEnvio('form-envio-ok', 'Ya recibimos estas respuestas. No hace falta enviarlas de nuevo.');
    return;
  }

  estadoEnvio('form-envio-cargando', 'Enviando tus respuestas a R3ADS…');

  const datos = {
    creado: firebase.firestore.FieldValue.serverTimestamp(),
    estado: 'nuevo',
    nombre: valorDe('nombre'),
    empresa: valorDe('empresa'),
    telPersona: valorDe('tel_persona'),
    telEmpresa: valorDe('tel_empresa'),
    secciones,
    origen: location.href.slice(0, 200)
  };
  if (valorDe('instagram')) datos.instagram = valorDe('instagram');

  try {
    await window.r3Db.collection('intakes').add(datos);
    huellaEnviada = huella;
    estadoEnvio('form-envio-ok',
      'Recibido. Tus respuestas ya llegaron a R3ADS y te contactamos al ' + valorDe('tel_persona') + '.');
  } catch (err) {
    console.error('[R3ADS] No se pudo guardar el intake:', err);
    estadoEnvio('form-envio-error',
      'No pudimos enviarlo automáticamente. Descargá el documento y mandanoslo por WhatsApp: nos llega igual.');
  }
}

/* ---------- Generar ---------- */
let seccionesActuales = [];

btnGenerar.addEventListener('click', () => {
  // Los requeridos viven en el paso 1: validarlos aunque estemos al final.
  const faltantes = Array.from(form.querySelectorAll('[required]')).filter((c) => !c.value.trim());
  if (faltantes.length) {
    const paso = pasos.findIndex((p) => p.contains(faltantes[0]));
    mostrarPaso(paso);
    formError.textContent = 'Faltan datos de contacto obligatorios para poder comunicarnos con vos.';
    formError.hidden = false;
    faltantes[0].classList.add('campo-invalido');
    faltantes[0].focus();
    return;
  }

  seccionesActuales = recolectar();
  intakeDoc.innerHTML = R3Intake.docHTML(seccionesActuales, empresaActual());

  const mensaje =
    `Hola R3ADS, completé el formulario de intake.\n\n` +
    `Empresa: ${valorDe('empresa')}\n` +
    `Nombre: ${valorDe('nombre')}\n` +
    `Mi teléfono: ${valorDe('tel_persona')}\n` +
    `Teléfono de la empresa: ${valorDe('tel_empresa')}\n` +
    (valorDe('instagram') ? `Instagram: ${valorDe('instagram')}\n` : '') +
    `\nLes adjunto el documento de intake completo.`;
  document.getElementById('btnWhatsapp').href =
    `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

  form.hidden = true;
  formWrapSecciones.hidden = true;
  resultado.hidden = false;
  resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });

  enviarAFirestore(seccionesActuales);
});

document.getElementById('btnDescargar').addEventListener('click', () => {
  R3Intake.descargar(seccionesActuales, empresaActual());
});

document.getElementById('btnCopiar').addEventListener('click', async (e) => {
  const boton = e.currentTarget;
  const original = boton.textContent;
  await R3Intake.copiar(R3Intake.docTexto(seccionesActuales, empresaActual()));
  boton.textContent = 'Copiado';
  setTimeout(() => { boton.textContent = original; }, 2000);
});

document.getElementById('btnEditar').addEventListener('click', () => {
  resultado.hidden = true;
  form.hidden = false;
  formWrapSecciones.hidden = false;
  mostrarPaso(pasos.length - 1);
  document.querySelector('.form-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ---------- Init ---------- */
progresoTotal.textContent = pasos.length;
restaurar();
mostrarPaso(0);
