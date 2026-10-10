/* ================================================================
   clinic-trial-gate.js — Banda de estado de la suscripción (Ancla).

   Una clínica recién auto-registrada nace en clinics/{clinicId}.estado =
   'prueba_libre' con un `pruebaExpira` a 7 días (ver
   crearClinicaSelfService en functions/index.js): durante esos días
   trabaja con el portal completo SIN meter tarjeta, y clinicActiva() en
   firestore.rules la deja leer y escribir datos clínicos reales. Cuando
   `pruebaExpira` pasa, esa misma función deja de aceptarla y el portal se
   vuelve de solo mirar hasta que active con PayPal.

   Por qué sin tarjeta (2026-10-10): antes nacía en 'prueba_bloqueada', que
   exigía PayPal antes de poder guardar un solo paciente. Vendiéndole a
   consultorios de Honduras ese muro mataba la conversión del carril de
   autoservicio — ver FUNNEL.md, Fase 2. 'prueba_bloqueada' sigue existiendo
   para las clínicas dadas de alta antes del cambio.

   Este archivo NO es el candado (ese es firestore.rules, como con los
   módulos — ver clinic-modules.js). Es solo la banda que explica en qué
   estado está la suscripción, con un botón directo a activar. Se llama una
   vez desde el AUTH GUARD de cada página, igual que r3adsModulos.cargar().

   El auth guard llama a `evaluar(clinicId)` y nada más: qué estados
   muestran banda y con qué texto se decide ACÁ. Antes esa lista de estados
   estaba repetida en el guard de las 15 páginas, que es 15 lugares donde
   olvidarse de agregar uno nuevo. */
(function (global) {
  'use strict';

  var UN_DIA_MS = 24 * 60 * 60 * 1000;

  /* Devuelve { estado, pruebaExpira } — pruebaExpira como Date o null.
     Sin red/permiso devuelve null y no se muestra nada: las reglas igual
     protegen, la banda es solo informativa. */
  function cargarDatos(clinicId) {
    var db = typeof global.r3adsDb !== 'undefined' ? global.r3adsDb : null;
    if (!db || !clinicId) return Promise.resolve(null);
    return db.collection('clinics').doc(clinicId).get()
      .then(function (doc) {
        if (!doc.exists) return null;
        var d = doc.data() || {};
        return {
          estado: d.estado || null,
          pruebaExpira: (d.pruebaExpira && typeof d.pruebaExpira.toDate === 'function')
            ? d.pruebaExpira.toDate()
            : null
        };
      })
      .catch(function () { return null; });
  }

  // Compatibilidad: algún llamador viejo puede seguir pidiendo solo el estado.
  function cargar(clinicId) {
    return cargarDatos(clinicId).then(function (d) { return d ? d.estado : null; });
  }

  function diasRestantes(pruebaExpira) {
    if (!pruebaExpira) return 0;
    return Math.max(0, Math.ceil((pruebaExpira.getTime() - Date.now()) / UN_DIA_MS));
  }

  /* Copia por estado. Las cuatro variantes bloqueantes ('prueba_vencida',
     'prueba_bloqueada', 'cancelada', 'suspendida') comparten que
     clinicActiva() las rechaza igual; el mensaje solo ayuda al admin a
     entender por qué y a dónde ir — Mi-Suscripcion.html resuelve las cuatro
     (crearSuscripcionPayPal o revisarSuscripcionPayPal, según si ya existe
     un paypalSubscriptionId vigente).

     'prueba_libre' es la única NO bloqueante: la clínica está trabajando
     normal y la banda solo cuenta los días. Por eso es la única en tono
     neutro y con `suave: true`. */
  var BANNER_COPY = {
    prueba_libre: {
      suave: true,
      texto: function (dias) {
        if (dias <= 1) return '⏳ Hoy es el <b>último día</b> de tu prueba gratis — activa tu suscripción para no perder el acceso.';
        return '✅ Prueba gratis — te quedan <b>' + dias + ' días</b>. No hace falta tarjeta hasta que termine.';
      },
      cta: 'Activar suscripción'
    },
    prueba_vencida: {
      texto: function () { return '⏳ Tu <b>prueba gratis terminó</b> — activa tu suscripción para volver a guardar pacientes, consultas y todo lo demás.'; },
      cta: 'Activar suscripción'
    },
    // Clínicas dadas de alta antes del cambio del 2026-10-10: nunca activaron
    // y nunca tuvieron prueba libre.
    prueba_bloqueada: {
      texto: function () { return '👀 Estás en <b>vista previa</b> — activa tu prueba gratis de 7 días para guardar pacientes, consultas y todo lo demás.'; },
      cta: 'Activar prueba gratis'
    },
    cancelada: {
      texto: function () { return '⏸️ Tu suscripción está <b>cancelada</b> — reactivala para volver a guardar pacientes, consultas y todo lo demás.'; },
      cta: 'Reactivar suscripción'
    },
    suspendida: {
      texto: function () { return '⚠️ Tu suscripción está <b>suspendida</b> — puede que PayPal no haya podido cobrar. Revisala para no perder acceso.'; },
      cta: 'Revisar suscripción'
    }
  };

  function mostrarBanner(estado, pruebaExpira) {
    if (document.getElementById('trial-gate-banner')) return; // ya está
    var copy = BANNER_COPY[estado];
    if (!copy) return;

    var b = document.createElement('div');
    b.id = 'trial-gate-banner';
    // Ink #242F40 / Golden Bronze #CCA43B — paleta de Ancla, nunca la de CMG.
    var fondo = copy.suave ? '#363636' : '#242F40';
    b.style.cssText = 'position:sticky;top:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
      'gap:14px;flex-wrap:wrap;padding:10px 16px;background:' + fondo + ';color:#fff;font-family:system-ui,sans-serif;' +
      'font-size:13.5px;text-align:center';
    b.innerHTML =
      '<span>' + copy.texto(diasRestantes(pruebaExpira)) + '</span>' +
      '<a href="Mi-Suscripcion.html" style="background:#CCA43B;color:#242F40;padding:6px 14px;border-radius:6px;' +
      'font-weight:700;text-decoration:none;white-space:nowrap">' + copy.cta + '</a>';
    document.body.insertBefore(b, document.body.firstChild);
  }

  /* Único punto de entrada para el auth guard. 'activa' no muestra nada;
     'prueba_libre' se parte en dos según el reloj, igual que lo hace
     clinicActiva() en firestore.rules — si acá dijera "te quedan 0 días"
     pero las reglas ya bloquearan, el admin no entendería nada. */
  function evaluar(clinicId) {
    return cargarDatos(clinicId).then(function (d) {
      if (!d || !d.estado || d.estado === 'activa') return null;
      var estado = d.estado;
      if (estado === 'prueba_libre' && diasRestantes(d.pruebaExpira) <= 0) {
        estado = 'prueba_vencida';
      }
      mostrarBanner(estado, d.pruebaExpira);
      return estado;
    });
  }

  global.r3adsTrialGate = {
    evaluar: evaluar,
    cargar: cargar,
    cargarDatos: cargarDatos,
    mostrarBanner: mostrarBanner
  };
})(window);
