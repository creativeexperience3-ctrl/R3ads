/* ============================================================
   R3ADS · Inicialización de Firebase
   Requiere firebase-app-compat + firebase-firestore-compat
   (y firebase-auth-compat en el panel de administración)
   cargados antes de este script.

   La config de un proyecto Firebase web NO es secreta: identifica el
   proyecto, no autoriza nada. Quien protege los datos es firestore.rules.
   ============================================================ */
(function () {
  var config = {
    apiKey           : 'AIzaSyDEugPITETLwrD5HJHq9KQPr3G2MR8WD1k',
    authDomain       : 'r3ads-59bd8.firebaseapp.com',
    projectId        : 'r3ads-59bd8',
    storageBucket    : 'r3ads-59bd8.firebasestorage.app',
    messagingSenderId: '684140109584',
    appId            : '1:684140109584:web:00c216621b729343b68f95'
  };

  // Mientras la config esté sin llenar, el sitio sigue funcionando:
  // el formulario cae a descarga + WhatsApp y el panel avisa que falta.
  window.r3Configurado = config.apiKey !== 'PENDIENTE';

  if (!window.r3Configurado) {
    console.warn('[R3ADS] Firebase todavía sin configurar (firebase-init.js).');
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(config);
  window.r3Db = firebase.firestore();
  if (firebase.auth) window.r3Auth = firebase.auth();
})();
