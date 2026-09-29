/* ============================================================
   R3ads Portal Clínico · Inicialización de Firebase
   Requiere: firebase-app-compat + firebase-app-check-compat +
             firebase-auth-compat + firebase-firestore-compat
             cargados antes de este script.

   Proyecto: r3ads-clinic-crm (cuenta creativeexperience3@gmail.com),
   propio de este producto — separado del Firebase de CMG
   (clinica-medica-general) y del de R3ads/web (r3ads-59bd8).

   App Check (2026-09-26): activado con Fraud Defense (reCAPTCHA
   Enterprise) — la site key NO es secreta (pública por diseño, como el
   apiKey de arriba). Registrado en Firebase Console en modo "Sin aplicar"
   (monitoreo): todavía no bloquea nada, solo mide tráfico verificado vs
   no verificado. Pasar Firestore/Storage/Functions a "Aplicar" es un paso
   aparte, manual, solo cuando se confirme en las métricas que el tráfico
   real ya llega verificado.
   ============================================================ */
(function () {
  var config = {
    apiKey           : 'AIzaSyANySdjfYwE2CnLbsg-YZdBCxWrD6CNLMo',
    authDomain       : 'r3ads-clinic-crm.firebaseapp.com',
    projectId        : 'r3ads-clinic-crm',
    storageBucket    : 'r3ads-clinic-crm.firebasestorage.app',
    messagingSenderId: '185048797679',
    appId            : '1:185048797679:web:04da52fcc3c336f7f5a61a'
  };
  if (!firebase.apps.length) firebase.initializeApp(config);
  // try/catch a propósito: el script de reCAPTCHA Enterprise que activa App
  // Check puede tirar (ej. "Cannot read properties of null (reading
  // 'appendChild')" cuando un bloqueador de anuncios/privacidad impide que
  // inyecte su badge en el DOM). Sin este try/catch, esa excepción
  // interrumpe TODO este script antes de llegar a definir r3adsAuth/r3adsDb
  // más abajo — tumbando el login de la página entera por algo que está en
  // modo "solo monitoreo" y no debería bloquear nada (ver nota arriba).
  // activarAppCheck se llama abajo, pero SOLO cuando ya existe document.body.
  // reCAPTCHA Enterprise inyecta su badge con document.body.appendChild, así
  // que si este script corre desde el <head> —cuando body todavía no existe—
  // revienta con "Cannot read properties of null (reading 'appendChild')" y
  // App Check NUNCA se activa en esa página. Pasó de verdad en cuatro páginas
  // que cargaban este archivo desde el <head> (Admin-Precios, Admin-Usuarios,
  // Mi-Suscripcion, Seguridad): fallaban en silencio, porque en modo
  // monitoreo un App Check muerto no se nota en ningún lado. Con Firestore /
  // Storage / Functions en "Aplicar", esas páginas habrían dejado de
  // funcionar por completo.
  //
  // Lo correcto sigue siendo cargar este script desde el <body> (así lo hacen
  // las demás páginas), porque entonces App Check queda activo ANTES de que
  // corra cualquier código de la página y no hay carrera posible. Esto es la
  // red de seguridad para que una página nueva que se equivoque active tarde
  // en vez de no activar nunca.
  function activarAppCheck() {
    try {
      firebase.appCheck().activate(
        new firebase.appCheck.ReCaptchaEnterpriseProvider('6LeCddAtAAAAACM_6iq-lJ8Kdl0tDVu9-Av2Rbhw'),
        true // isTokenAutoRefreshEnabled
      );
    } catch (err) {
      // try/catch a propósito: un fallo del script de reCAPTCHA (ej. bloqueado
      // por un ad-blocker) no debe interrumpir este archivo antes de definir
      // r3adsAuth/r3adsDb más abajo — eso tumbaría el login de la página
      // entera. Con App Check en "Aplicar" el usuario igual no podrá leer
      // datos, pero verá un error de permisos y no una página en blanco.
      console.error('[firebase-init] App Check no se pudo activar:', err);
    }
  }

  if (firebase.appCheck) {
    if (document.body) activarAppCheck();
    else document.addEventListener('DOMContentLoaded', activarAppCheck, { once: true });
  }
  window.r3adsAuth = firebase.auth();
  window.r3adsDb   = firebase.firestore();
  // Expuesto para páginas que necesitan una instancia secundaria de Firebase
  // (ej. Admin-Usuarios.html crea usuarios sin cerrar la sesión del admin) —
  // así ninguna página vuelve a duplicar la config a mano.
  window.r3adsFirebaseConfig = config;
})();
