/* ============================================================
   R3ADS · Reporte de Sesión Cero
   El documento que se entrega al cliente al terminar la reunión.

   Sigue la regla del instrumento: al cliente se le muestra el
   MATERIAL, no solo la conclusión. Por eso los hallazgos van
   completos y cada entrada del FODA cita los códigos que la
   sostienen. Las notas crudas de los módulos NO van en el reporte:
   son material de trabajo, y su destilado ya son los hallazgos.
   ============================================================ */
window.R3Sesion = (function () {

  const esc = window.R3Intake.esc;
  const fechaLarga = window.R3Intake.fechaLarga;

  function nl(s) { return esc(s).replace(/\n/g, '<br>'); }

  function conteo(hallazgos) {
    return {
      total: hallazgos.length,
      dato: hallazgos.filter((h) => h.clase === 'dato').length,
      creencia: hallazgos.filter((h) => h.clase === 'creencia').length,
      ciego: hallazgos.filter((h) => h.clase === 'ciego').length
    };
  }

  /* Ficha completa de un hallazgo: los ocho campos de la anatomía,
     siempre en el mismo orden. Los vacíos se omiten. */
  function ficha(h) {
    const clase = window.R3Guion.clases[h.clase] || window.R3Guion.clases.dato;
    const filas = [
      ['Módulo', h.modulo],
      ['Fuente', h.fuente],
      ['Evidencia', h.evidencia],
      ['Tensión', h.tension],
      ['Implicación', h.implicacion],
      ['Alimenta', h.alimenta],
      ['Verificación', h.verificacion]
    ].filter(([, v]) => v && String(v).trim());

    return `<article class="sd-ficha sd-ficha--${esc(h.clase)}">
      <header class="sd-fhead">
        <span class="sd-code">${esc(h.codigo)}</span>
        <h4>${esc(h.titulo)}</h4>
        <span class="sd-tipo sd-tipo--${esc(h.clase)}">${esc(clase.texto)}</span>
      </header>
      <dl class="sd-fbody">
        ${filas.map(([k, v]) => `<div class="sd-frow">
          <dt>${esc(k)}</dt><dd>${nl(v)}</dd></div>`).join('')}
      </dl>
    </article>`;
  }

  function bloqueFoda(sesion) {
    const bloques = window.R3Guion.foda.map((cat) => {
      const entradas = (sesion.foda && sesion.foda[cat.id]) || [];
      if (!entradas.length) return '';
      return `<div class="sd-foda-cat">
        <h3><span>${cat.id}</span> ${esc(cat.nombre)}</h3>
        <ol class="sd-foda-lista">
          ${entradas.map((e, i) => `<li>
            <span class="sd-foda-cod">${cat.id}${i + 1}</span>
            <span class="sd-foda-texto">${nl(e.texto)}</span>
            ${e.hallazgos && e.hallazgos.length
              ? `<span class="sd-foda-traza">(${esc(e.hallazgos.join(', '))})</span>`
              : '<span class="sd-foda-sintraza">sin trazabilidad</span>'}
          </li>`).join('')}
        </ol>
      </div>`;
    }).filter(Boolean).join('');

    return bloques || '<p class="sd-vacio">La destilación al FODA todavía no se completó.</p>';
  }

  /* Lo que NO entra al FODA y sí se le entrega al cliente: los puntos
     ciegos y las creencias sin verificar. Es la agenda de la fase
     siguiente, y sale sola de la clasificación de los hallazgos. */
  function bloquePendientes(hallazgos) {
    const ciegos = hallazgos.filter((h) => h.clase === 'ciego');
    const creencias = hallazgos.filter((h) => h.clase === 'creencia');
    if (!ciegos.length && !creencias.length) return '';

    const fila = (h) => `<tr>
      <td class="sd-num">${esc(h.codigo)}</td>
      <td>${esc(h.titulo)}</td>
      <td>${esc(h.verificacion || '—')}</td>
    </tr>`;

    let html = `<section class="sd-seccion">
      <h2><span>04</span> Información pendiente</h2>
      <p class="sd-intro">Esto no entra al FODA todavía. Son las preguntas que el negocio
      no se ha hecho y las afirmaciones que se operan sin haberse medido. Resolverlas es
      la agenda de la siguiente fase.</p>`;

    if (creencias.length) {
      html += `<h3 class="sd-sub">Creencias por verificar</h3>
        <div class="sd-tabla"><table>
        <thead><tr><th>Código</th><th>Lo que se afirma</th><th>Cómo se comprueba</th></tr></thead>
        <tbody>${creencias.map(fila).join('')}</tbody></table></div>`;
    }
    if (ciegos.length) {
      html += `<h3 class="sd-sub">Puntos ciegos</h3>
        <div class="sd-tabla"><table>
        <thead><tr><th>Código</th><th>Lo que no se ha preguntado</th><th>Cómo se resuelve</th></tr></thead>
        <tbody>${ciegos.map(fila).join('')}</tbody></table></div>`;
    }
    return html + '</section>';
  }

  function docHTML(sesion) {
    const h = sesion.hallazgos || [];
    const c = conteo(h);
    const fecha = sesion.fechaSesion ? new Date(sesion.fechaSesion + 'T12:00:00') : new Date();

    return `
    <header class="sd-portada">
      <p class="sd-marca">R3<span>ADS</span></p>
      <p class="sd-doc">Documento 00 · Sesión Cero</p>
      <h1>${esc(sesion.empresa || 'Sin empresa')}</h1>
      <p class="sd-fecha">Sesión del ${esc(fechaLarga(fecha))}</p>
    </header>

    <section class="sd-seccion">
      <h2><span>01</span> Qué es este documento</h2>
      <p class="sd-intro">Un FODA entregado a alguien que lleva años en su negocio casi siempre
      produce la misma reacción: «eso ya lo sabía». No porque el análisis esté mal, sino porque
      el valor nunca estuvo en la conclusión — estaba en el material que la produjo.</p>
      <p class="sd-intro">Acá está ese material. Cada hallazgo es un hecho con su fuente, y cada
      entrada del FODA lleva entre paréntesis los códigos que la sostienen. Cualquier conclusión
      de este documento se puede rastrear hasta el hecho que la originó.</p>

      <div class="sd-cifras">
        <div><b>${c.total}</b><span>hallazgos</span></div>
        <div><b>${c.dato}</b><span>datos verificados</span></div>
        <div><b>${c.creencia}</b><span>creencias por medir</span></div>
        <div><b>${c.ciego}</b><span>puntos ciegos</span></div>
      </div>
    </section>

    <section class="sd-seccion">
      <h2><span>02</span> Hallazgos</h2>
      <p class="sd-intro">Cada uno lleva su fuente, la evidencia sin interpretar, y la tensión
      contra la que choca. Un hallazgo sin tensión sería solo un apunte de inventario.</p>
      ${h.length ? h.map(ficha).join('') : '<p class="sd-vacio">Todavía no se registraron hallazgos.</p>'}
    </section>

    <section class="sd-seccion">
      <h2><span>03</span> Destilación al FODA</h2>
      <p class="sd-intro">Solo entran los datos. Las creencias y los puntos ciegos quedan
      en la sección siguiente hasta que se conviertan en dato.</p>
      ${bloqueFoda(sesion)}
    </section>

    ${bloquePendientes(h)}

    <footer class="sd-pie">
      <p><b>R3ADS</b> · Agencia de Marketing Digital · Construimos Digital Footprints.</p>
      <p>WhatsApp +504 9565-2894 · Documento 00 · Sesión Cero v1.0</p>
    </footer>`;
  }

  /* Estilos del reporte: viven acá para que el archivo descargado
     sea autosuficiente y se pueda imprimir a PDF sin el sitio. */
  const CSS = `
  :root { --naranja:#FD7D20; --grafito:#211F1D; --gris:#A3A2A1; --linea:#E2DEDA; --panel:#F5F3F1; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter','Segoe UI',system-ui,sans-serif; color:var(--grafito);
         line-height:1.62; background:#fff; padding:3rem 1.5rem; }
  .sd { max-width:820px; margin:0 auto; }
  .sd-portada { background:var(--grafito); color:#fff; padding:2.5rem 2rem; margin-bottom:3rem; }
  .sd-marca { font-weight:900; font-size:1.35rem; letter-spacing:-.02em; }
  .sd-marca span { color:var(--naranja); }
  .sd-doc { font-size:.7rem; letter-spacing:.16em; text-transform:uppercase;
            color:var(--naranja); font-weight:700; margin-top:1.75rem; }
  .sd-portada h1 { font-size:2.4rem; font-weight:900; text-transform:uppercase;
                   line-height:1.02; letter-spacing:-.03em; margin:.2rem 0; }
  .sd-fecha { color:var(--gris); font-size:.85rem; }
  .sd-seccion { margin-bottom:3.5rem; }
  .sd-seccion h2 { font-size:1.35rem; font-weight:900; text-transform:uppercase;
                   letter-spacing:-.02em; border-bottom:3px solid var(--naranja);
                   padding-bottom:.5rem; margin-bottom:1.25rem; }
  .sd-seccion h2 span { color:var(--naranja); margin-right:.5rem; }
  .sd-sub { font-size:1rem; font-weight:700; margin:2rem 0 .75rem; }
  .sd-intro { color:#4a4846; margin-bottom:1rem; max-width:62ch; }
  .sd-vacio { color:var(--gris); font-style:italic; }
  .sd-cifras { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
               gap:1px; background:var(--linea); border:1px solid var(--linea); margin-top:1.75rem; }
  .sd-cifras div { background:#fff; padding:1rem 1.1rem; }
  .sd-cifras b { display:block; font-size:1.9rem; font-weight:900; color:var(--naranja); line-height:1; }
  .sd-cifras span { font-size:.7rem; letter-spacing:.1em; text-transform:uppercase; color:var(--gris); }
  .sd-ficha { border:1px solid var(--linea); border-left:3px solid var(--grafito);
              margin-bottom:1.1rem; page-break-inside:avoid; }
  .sd-ficha--creencia { border-left-color:var(--naranja); }
  .sd-ficha--ciego { border-left:3px dashed var(--gris); }
  .sd-fhead { display:flex; flex-wrap:wrap; gap:.6rem 1rem; align-items:center;
              padding:.9rem 1.35rem; border-bottom:1px solid var(--linea); background:var(--panel); }
  .sd-code { font-weight:700; font-size:.78rem; color:var(--naranja); }
  .sd-fhead h4 { flex:1 1 260px; font-size:1rem; line-height:1.3; font-weight:700; }
  .sd-tipo { font-size:.62rem; letter-spacing:.14em; text-transform:uppercase;
             font-weight:700; padding:.2rem .55rem; white-space:nowrap; }
  .sd-tipo--dato { background:var(--grafito); color:#fff; }
  .sd-tipo--creencia { background:var(--naranja); color:var(--grafito); }
  .sd-tipo--ciego { border:1px dashed var(--gris); color:#6B6764; }
  .sd-fbody { padding:.25rem 1.35rem 1rem; }
  .sd-frow { display:grid; grid-template-columns:110px 1fr; gap:.25rem 1.1rem;
             padding:.65rem 0; border-bottom:1px dashed var(--linea); }
  .sd-frow:last-child { border-bottom:0; }
  .sd-frow dt { font-size:.63rem; letter-spacing:.13em; text-transform:uppercase;
                color:var(--gris); font-weight:700; padding-top:.25em; }
  .sd-frow dd { font-size:.93rem; }
  .sd-foda-cat { margin-bottom:1.75rem; }
  .sd-foda-cat h3 { font-size:1rem; font-weight:900; text-transform:uppercase; margin-bottom:.6rem; }
  .sd-foda-cat h3 span { color:var(--naranja); }
  .sd-foda-lista { list-style:none; border:1px solid var(--linea); }
  .sd-foda-lista li { display:flex; flex-wrap:wrap; gap:.4rem .8rem; align-items:baseline;
                      padding:.8rem 1.1rem; border-bottom:1px solid var(--linea); font-size:.93rem; }
  .sd-foda-lista li:last-child { border-bottom:0; }
  .sd-foda-cod { font-weight:700; font-size:.75rem; color:var(--naranja); flex:none; }
  .sd-foda-texto { flex:1 1 300px; }
  .sd-foda-traza { font-size:.78rem; color:var(--gris); }
  .sd-foda-sintraza { font-size:.72rem; color:#d64545; letter-spacing:.06em; text-transform:uppercase; }
  .sd-tabla { border:1px solid var(--linea); overflow-x:auto; margin-bottom:1.25rem; }
  .sd-tabla table { border-collapse:collapse; width:100%; font-size:.9rem; }
  .sd-tabla th, .sd-tabla td { text-align:left; padding:.65rem .9rem;
                               border-bottom:1px solid var(--linea); vertical-align:top; }
  .sd-tabla thead th { background:var(--panel); font-size:.65rem; letter-spacing:.12em;
                       text-transform:uppercase; color:var(--gris); font-weight:700; }
  .sd-tabla tbody tr:last-child td { border-bottom:0; }
  .sd-num { font-weight:700; color:var(--naranja); white-space:nowrap; }
  .sd-pie { border-top:1px solid var(--linea); padding-top:1.25rem; margin-top:3rem;
            font-size:.8rem; color:var(--gris); }
  @media print { body { padding:0; } .sd-seccion { page-break-inside:auto; } }
  `;

  function archivoHTML(sesion) {
    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sesión Cero · ${esc(sesion.empresa || 'R3ADS')}</title>
<style>${CSS}</style></head>
<body><div class="sd">${docHTML(sesion)}</div></body></html>`;
  }

  function docTexto(sesion) {
    const h = sesion.hallazgos || [];
    const L = ['REPORTE DE SESIÓN CERO · R3ADS',
      (sesion.empresa || '').toUpperCase(),
      'Sesión del ' + fechaLarga(sesion.fechaSesion ? new Date(sesion.fechaSesion + 'T12:00:00') : new Date()),
      '', 'HALLAZGOS', ''];

    h.forEach((x) => {
      L.push(`${x.codigo} · [${(window.R3Guion.clases[x.clase] || {}).texto || ''}] ${x.titulo}`);
      [['Módulo', x.modulo], ['Fuente', x.fuente], ['Evidencia', x.evidencia],
       ['Tensión', x.tension], ['Implicación', x.implicacion], ['Alimenta', x.alimenta],
       ['Verificación', x.verificacion]]
        .filter(([, v]) => v && String(v).trim())
        .forEach(([k, v]) => L.push(`   ${k}: ${v}`));
      L.push('');
    });

    L.push('', 'DESTILACIÓN AL FODA', '');
    window.R3Guion.foda.forEach((cat) => {
      const es = (sesion.foda && sesion.foda[cat.id]) || [];
      if (!es.length) return;
      L.push(cat.nombre.toUpperCase());
      es.forEach((e, i) => L.push(`  ${cat.id}${i + 1}. ${e.texto}` +
        (e.hallazgos && e.hallazgos.length ? ` (${e.hallazgos.join(', ')})` : '')));
      L.push('');
    });

    L.push('R3ADS · Agencia de Marketing Digital · WhatsApp +504 9565-2894');
    return L.join('\n');
  }

  function nombreArchivo(sesion) {
    const slug = (sesion.empresa || 'sesion')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
      .slice(0, 40) || 'sesion';
    const f = sesion.fechaSesion || new Date().toISOString().slice(0, 10);
    return `Sesion-Cero-R3ADS-${slug}-${f}.html`;
  }

  function descargar(sesion) {
    const blob = new Blob([archivoHTML(sesion)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo(sesion);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { docHTML, docTexto, archivoHTML, nombreArchivo, descargar, conteo };
})();
