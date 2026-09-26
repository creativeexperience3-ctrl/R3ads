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
  if (firebase.appCheck) {
    firebase.appCheck().activate(
      new firebase.appCheck.ReCaptchaEnterpriseProvider('6LeCddAtAAAAACM_6iq-lJ8Kdl0tDVu9-Av2Rbhw'),
      true // isTokenAutoRefreshEnabled
    );
  }
  window.r3adsAuth = firebase.auth();
  window.r3adsDb   = firebase.firestore();
  // Expuesto para páginas que necesitan una instancia secundaria de Firebase
  // (ej. Admin-Usuarios.html crea usuarios sin cerrar la sesión del admin) —
  // así ninguna página vuelve a duplicar la config a mano.
  window.r3adsFirebaseConfig = config;
})();
