/* ============================================================
   R3ADS · Documento de intake
   Render compartido entre el formulario (formulario.js) y el panel
   de administración (admin.js), para que el cliente y R3ADS vean
   exactamente el mismo documento.

   Estructura de 'secciones':
     [{ titulo, campos: [{ label, valores: [string], lista: bool }] }]
   ============================================================ */
window.R3Intake = (function () {

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fechaLarga(d) {
    return (d || new Date()).toLocaleDateString('es-HN', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  function docHTML(secciones, empresa, fecha) {
    const nombreEmpresa = empresa || 'Sin nombre de empresa';
    let html = `
    <div class="intake-header">
      <p class="intake-marca">R3<span>ADS</span></p>
      <p class="intake-tipo">Documento de intake</p>
      <h1 class="intake-empresa">${esc(nombreEmpresa)}</h1>
      <p class="intake-fecha">Generado el ${esc(fechaLarga(fecha))}</p>
    </div>`;

    (secciones || []).forEach((sec, i) => {
      html += `<section class="intake-seccion">
      <h2><span>${String(i + 1).padStart(2, '0')}</span> ${esc(sec.titulo)}</h2>`;
      (sec.campos || []).forEach((campo) => {
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

  function docTexto(secciones, empresa, fecha) {
    const lineas = [
      'DOCUMENTO DE INTAKE · R3ADS',
      (empresa || 'Sin nombre de empresa').toUpperCase(),
      'Generado el ' + fechaLarga(fecha),
      ''
    ];
    (secciones || []).forEach((sec, i) => {
      lineas.push('', `${String(i + 1).padStart(2, '0')}. ${sec.titulo.toUpperCase()}`, '');
      (sec.campos || []).forEach((campo) => {
        lineas.push(campo.label + ':');
        campo.valores.forEach((v) => lineas.push(campo.lista ? '  - ' + v : '  ' + v));
        lineas.push('');
      });
    });
    lineas.push('R3ADS · Agencia de Marketing Digital · WhatsApp +504 9565-2894');
    return lineas.join('\n');
  }

  /* Documento independiente: no depende de style.css, se puede abrir
     desde cualquier carpeta e imprimir a PDF desde el navegador. */
  function archivoHTML(secciones, empresa, fecha) {
    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Intake R3ADS · ${esc(empresa || 'Intake')}</title>
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
<body><div class="doc">${docHTML(secciones, empresa, fecha)}</div></body></html>`;
  }

  function nombreArchivo(empresa, fecha) {
    const slug = (empresa || 'intake')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'intake';
    return `Intake-R3ADS-${slug}-${(fecha || new Date()).toISOString().slice(0, 10)}.html`;
  }

  function descargar(secciones, empresa, fecha) {
    const blob = new Blob([archivoHTML(secciones, empresa, fecha)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo(empresa, fecha);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  /* Numero hondureno de 8 digitos -> formato wa.me con codigo de pais. */
  function waLink(telefono, mensaje) {
    let n = String(telefono || '').replace(/\D/g, '');
    if (n.length === 8) n = '504' + n;
    return `https://wa.me/${n}` + (mensaje ? `?text=${encodeURIComponent(mensaje)}` : '');
  }

  return { esc, fechaLarga, docHTML, docTexto, archivoHTML, nombreArchivo, descargar, copiar, waLink };
})();
