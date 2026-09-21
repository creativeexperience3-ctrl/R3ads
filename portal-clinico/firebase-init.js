/* ============================================================
   R3ads Portal Clínico · Inicialización de Firebase
   Requiere: firebase-app-compat + firebase-auth-compat +
             firebase-firestore-compat cargados antes de este script.

   Proyecto: r3ads-clinic-crm (cuenta creativeexperience3@gmail.com),
   propio de este producto — separado del Firebase de CMG
   (clinica-medica-general) y del de R3ads/web (r3ads-59bd8).
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
  window.r3adsAuth = firebase.auth();
  window.r3adsDb   = firebase.firestore();
  // Expuesto para páginas que necesitan una instancia secundaria de Firebase
  // (ej. Admin-Usuarios.html crea usuarios sin cerrar la sesión del admin) —
  // así ninguna página vuelve a duplicar la config a mano.
  window.r3adsFirebaseConfig = config;
})();
