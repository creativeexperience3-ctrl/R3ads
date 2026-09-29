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
   apiKey de arriba).

   ESTADO (2026-09-29): Firestore y Storage en "Aplicar". Identity Toolkit
   (Auth) queda a propósito en "Sin aplicar": si App Check fallara ahí, el
   usuario no podría ni entrar ni pedir un reset de contraseña — se quedaría
   sin ninguna forma de recuperarse solo. Las Cloud Functions tienen su
   propio criterio, por callable, en functions/index.js.

   LO QUE COSTÓ LLEGAR ACÁ — no repetir el atajo
   ----------------------------------------------
   El primer intento de encenderlo hubo que revertirlo a los tres minutos.
   La llave de reCAPTCHA Enterprise solo tenía autorizado el dominio
   r3ads-clinic-crm.web.app, así que con "Aplicar" encendido se cayeron:

     · https://r3ads.com/portal-admin.html — el panel de superadmin se sirve
       desde GitHub Pages, no desde Firebase Hosting. Fácil de olvidar.
     · https://ancla-paciente.web.app — el portal del paciente. Y algo peor:
       tras el 403 del exchange, el SDK se auto-bloquea 24 h
       (appCheck/throttled). Ese daño SOBREVIVE al rollback en el navegador
       de quien lo pisó.

   Se arregló agregando los dominios en Cloud Console (reCAPTCHA → la llave →
   Domains). Si mañana aparece un portal en un dominio nuevo —ancla.r3ads.com,
   por ejemplo— hay que agregarlo ANTES de que se publique, o ese portal nace
   roto.

   CÓMO SE VERIFICA (hacerlo así, no de memoria)
   ----------------------------------------------
   /clinics/{id}/catalogoConfig es `allow read: if true` en las reglas, así
   que sirve de sonda limpia: lo único que puede hacerla fallar es App Check.
     · Desde cada portal en el navegador: debe leer OK.
     · Con curl sin token: debe dar 403.
   Ambas direcciones comprobadas el 2026-09-29 en los tres portales.

   Un fetch() directo a una download URL de Storage (…?alt=media&token=…)
   NO lleva token de App Check y sigue funcionando igual — comprobado. De eso
   depende que exportarExpedienteZip pueda meter los adjuntos al ZIP.

   Para revertir: Firebase Console → App Check → APIs → "Unenforce" en Cloud
   Firestore y Cloud Storage.
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
