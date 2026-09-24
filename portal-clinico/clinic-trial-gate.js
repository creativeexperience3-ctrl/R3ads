/* ================================================================
   clinic-trial-gate.js — Aviso de "vista previa" (Ancla).

   Una clínica recién auto-registrada nace en clinics/{clinicId}.estado =
   'prueba_bloqueada' (ver crearClinicaSelfService en functions/index.js):
   puede iniciar sesión y mirar el portal, pero clinicActiva() en
   firestore.rules exige estado == 'activa' para leer o escribir cualquier
   dato clínico real (expedientes, consultas, etc.) — así que en la
   práctica ya no puede hacer nada hasta activar su prueba con PayPal.

   Este archivo NO es el candado (ese es firestore.rules, como con los
   módulos — ver clinic-modules.js). Es solo la banda que explica por qué
   las listas salen vacías y los guardados fallan, con un botón directo a
   activar. Se llama una vez desde el AUTH GUARD de cada página, igual que
   r3adsModulos.cargar(). */
(function (global) {
  'use strict';

  function cargar(clinicId) {
    var db = typeof global.r3adsDb !== 'undefined' ? global.r3adsDb : null;
    if (!db || !clinicId) return Promise.resolve(null);
    return db.collection('clinics').doc(clinicId).get()
      .then(function (doc) { return doc.exists ? doc.data().estado : null; })
      .catch(function () { return null; }); // sin red/permiso: no se muestra el aviso, las reglas igual protegen
  }

  function mostrarBanner() {
    if (document.getElementById('trial-gate-banner')) return; // ya está
    var b = document.createElement('div');
    b.id = 'trial-gate-banner';
    b.style.cssText = 'position:sticky;top:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
      'gap:14px;flex-wrap:wrap;padding:10px 16px;background:#242F40;color:#fff;font-family:system-ui,sans-serif;' +
      'font-size:13.5px;text-align:center';
    b.innerHTML =
      '<span>👀 Estás en <b>vista previa</b> — activa tu prueba gratis de 7 días para guardar pacientes, consultas y todo lo demás.</span>' +
      '<a href="Auth.html?activar=1" style="background:#CCA43B;color:#242F40;padding:6px 14px;border-radius:6px;' +
      'font-weight:700;text-decoration:none;white-space:nowrap">Activar prueba gratis</a>';
    document.body.insertBefore(b, document.body.firstChild);
  }

  global.r3adsTrialGate = { cargar: cargar, mostrarBanner: mostrarBanner };
})(window);
