/* ============================================================
   Portal Paciente (Ancla) · Inicialización de Firebase
   Requiere: firebase-app-compat + firebase-auth-compat +
             firebase-firestore-compat cargados antes de este script.

   Mismo proyecto Firebase que portal-clinico/ (r3ads-clinic-crm,
   cuenta creativeexperience3@gmail.com) — es la MISMA base de datos,
   el paciente solo entra por una carpeta/dominio distinto. No cambiar
   este config sin cambiar también portal-clinico/firebase-init.js.
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
})();
