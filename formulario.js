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

function fechaHoy() {
  return new Date().toLocaleDateString('es-HN', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* ---------- Render del documento ---------- */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function docHTML(secciones) {
  const empresa = valorDe('empresa') || 'Sin nombre de empresa';
  let html = `
    <div class="intake-header">
      <p class="intake-marca">R3<span>ADS</span></p>
      <p class="intake-tipo">Documento de intake</p>
      <h1 class="intake-empresa">${esc(empresa)}</h1>
      <p class="intake-fecha">Generado el ${esc(fechaHoy())}</p>
    </div>`;

  secciones.forEach((sec, i) => {
    html += `<section class="intake-seccion">
      <h2><span>${String(i + 1).padStart(2, '0')}</span> ${esc(sec.titulo)}</h2>`;
    sec.campos.forEach((campo) => {
      html += `<div class="intake-campo"><p class="intake-label">${esc(campo.label)}</p>`;
      if (campo.lista) {
        html += '<ul class="intake-lista">' +
          campo.valores.map((v) => `<li>${esc(v)}</li>`).join('') + '</ul>';
      } else {
        html += campo.valores
          .map((v) => `<p class="intake-valor">${esc(v).replace(/\n/g, '<br>')}</p>`)
          .join('');
      }
      html += '</div>';
    });
    html += '</section>';
  });

  html += `<p class="intake-pie">
    R3ADS · Agencia de Marketing Digital · Construimos Digital Footprints.<br>
    WhatsApp +504 9565-2894
  </p>`;
  return html;
}

function docTexto(secciones) {
  const lineas = [
    'DOCUMENTO DE INTAKE · R3ADS',
    (valorDe('empresa') || 'Sin nombre de empresa').toUpperCase(),
    'Generado el ' + fechaHoy(),
    ''
  ];
  secciones.forEach((sec, i) => {
    lineas.push('', `${String(i + 1).padStart(2, '0')}. ${sec.titulo.toUpperCase()}`, '');
    sec.campos.forEach((campo) => {
      lineas.push(campo.label + ':');
      campo.valores.forEach((v) => lineas.push(campo.lista ? '  - ' + v : '  ' + v));
      lineas.push('');
    });
  });
  lineas.push('R3ADS · Agencia de Marketing Digital · WhatsApp +504 9565-2894');
  return lineas.join('\n');
}

/* Documento independiente descargable (no depende de style.css) */
function archivoHTML(secciones) {
  const empresa = valorDe('empresa') || 'Intake';
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Intake R3ADS · ${esc(empresa)}</title>
<style>
  :root { --naranja:#FD7D20; --grafito:#211F1D; --gris:#A3A2A1; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; color:var(--grafito);
         line-height:1.6; background:#fff; padding:3rem 1.5rem; }
  .doc { max-width:760px; margin:0 auto; }
  .intake-header { border-bottom:3px solid var(--naranja); padding-bottom:1.5rem; margin-bottom:2.5rem; }
  .intake-marca { font-weight:900; font-size:1.5rem; letter-spacing:-0.02em; }
  .intake-marca span { color:var(--naranja); }
  .intake-tipo { text-transform:uppercase; letter-spacing:0.12em; font-size:0.72rem;
                 color:var(--naranja); font-weight:700; margin-top:1.25rem; }
  .intake-empresa { font-size:2rem; font-weight:900; text-transform:uppercase; line-height:1.1; margin:0.25rem 0; }
  .intake-fecha { color:var(--gris); font-size:0.85rem; }
  .intake-seccion { margin-bottom:2.5rem; page-break-inside:avoid; }
  .intake-seccion h2 { font-size:1.05rem; font-weight:900; text-transform:uppercase;
                       letter-spacing:0.02em; border-bottom:1px solid #e7e5e3;
                       padding-bottom:0.5rem; margin-bottom:1.25rem; }
  .intake-seccion h2 span { color:var(--naranja); margin-right:0.4rem; }
  .intake-campo { margin-bottom:1.25rem; }
  .intake-label { font-size:0.78rem; text-transform:uppercase; letter-spacing:0.06em;
                  font-weight:700; color:var(--gris); margin-bottom:0.25rem; }
  .intake-valor { white-space:pre-wrap; }
  .intake-lista { margin:0.25rem 0 0 1.1rem; }
  .intake-lista li { margin-bottom:0.15rem; }
  .intake-pie { border-top:1px solid #e7e5e3; padding-top:1.25rem; margin-top:3rem;
                font-size:0.8rem; color:var(--gris); }
  @media print { body { padding:0; } }
</style></head>
<body><div class="doc">${docHTML(secciones)}</div></body></html>`;
}

function nombreArchivo() {
  const empresa = (valorDe('empresa') || 'intake')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'intake';
  const f = new Date().toISOString().slice(0, 10);
  return `Intake-R3ADS-${empresa}-${f}.html`;
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
  intakeDoc.innerHTML = docHTML(seccionesActuales);

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
});

document.getElementById('btnDescargar').addEventListener('click', () => {
  const blob = new Blob([archivoHTML(seccionesActuales)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.getElementById('btnCopiar').addEventListener('click', async (e) => {
  const texto = docTexto(seccionesActuales);
  const boton = e.currentTarget;
  const original = boton.textContent;
  try {
    await navigator.clipboard.writeText(texto);
    boton.textContent = 'Copiado';
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    boton.textContent = 'Copiado';
  }
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
