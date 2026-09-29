/* ============================================================
   Portal Paciente (Ancla) · Inicialización de Firebase
   Requiere: firebase-app-compat + firebase-app-check-compat +
             firebase-auth-compat + firebase-firestore-compat
             cargados antes de este script.

   Mismo proyecto Firebase que portal-clinico/ (r3ads-clinic-crm,
   cuenta creativeexperience3@gmail.com) — es la MISMA base de datos,
   el paciente solo entra por una carpeta/dominio distinto. No cambiar
   este config sin cambiar también portal-clinico/firebase-init.js.

   App Check (2026-09-26): misma site key que portal-clinico (una sola
   app web registrada en Firebase para todo el proyecto) — ver el
   comentario completo en portal-clinico/firebase-init.js.

   OJO: este dominio (ancla-paciente.web.app) NO está autorizado en la llave
   de reCAPTCHA Enterprise, así que acá App Check nunca consigue token — el
   exchange responde 403 y el SDK se auto-bloquea 24 h. Hoy da igual porque
   Firestore/Storage están en "Sin aplicar", pero significa que encender
   "Aplicar" deja el portal del paciente muerto. Ver el detalle y la lista de
   dominios que faltan en portal-clinico/firebase-init.js (probado y
   revertido el 2026-09-29).
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
  // try/catch a propósito — ver el comentario completo en
  // portal-clinico/firebase-init.js: sin esto, un fallo del script de
  // reCAPTCHA Enterprise (ej. bloqueado por un ad-blocker) tumba TODO este
  // script antes de definir r3adsAuth/r3adsDb, rompiendo el login entero.
  if (firebase.appCheck) {
    try {
      firebase.appCheck().activate(
        new firebase.appCheck.ReCaptchaEnterpriseProvider('6LeCddAtAAAAACM_6iq-lJ8Kdl0tDVu9-Av2Rbhw'),
        true // isTokenAutoRefreshEnabled
      );
    } catch (err) {
      console.error('[firebase-init] App Check no se pudo activar (modo monitoreo, no debería bloquear nada):', err);
    }
  }
  window.r3adsAuth = firebase.auth();
  window.r3adsDb   = firebase.firestore();
})();
