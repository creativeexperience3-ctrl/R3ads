/* ================================================================
   r3ads-staff.js — Helpers de rol/clínica del Portal Clínico (R3ads,
   multi-tenant).

   Origen: CMG-Website/cmg-staff.js. Ahí el acceso de "siempre confía en
   este correo" vivía en listas ADMIN_EMAILS/STAFF_EMAILS hardcodeadas en
   este mismo archivo — imposible de sostener con muchas clínicas, cada una
   con su propio staff. Aquí NO hay ninguna cuenta con acceso automático:
   el rol y la clínica de cada usuario se leen siempre de su propio
   documento /usuarios/{uid} en Firestore (el mismo doc que ya usan las
   Security Rules — ver firestore.rules), y deben coincidir con el
   `clinicId` de la instancia que se está sirviendo.

   La única excepción es el superadmin de R3ads (panel interno de la
   plataforma, Fase 4 del plan), cuyo acceso se otorga una sola vez por
   Firebase Admin SDK como custom claim — nunca desde este archivo.

   CAMBIO DE API respecto al original: cada check ahora recibe `clinicId`
   como segundo argumento (la clínica cuya instancia está corriendo esta
   página) — antes bastaba con el usuario porque solo existía una clínica.
   Pendiente: al portar cada página (Expediente-Doctor.html,
   Admin-Usuarios.html, etc.) hay que resolver ese clinicId de la
   configuración de la instancia (ver clinic-config.js) y pasarlo aquí.
   ================================================================ */
(function (global) {
  'use strict';

  /* ── Refresco automático de custom claims ──────────────────────
     La Cloud Function onUsuarioWrite (functions/index.js) escribe en
     /_claimsRefresh/{uid} cada vez que cambian los claims de un usuario
     (recién creado, rol cambiado, desactivado...). Sin esto, el usuario
     seguiría usando su ID token viejo — sin el clinicId/rol nuevo — hasta
     que expire solo (hasta 1 hora) o vuelva a iniciar sesión. Aquí se
     escucha ese doc y se fuerza un refresh + recarga en cuanto cambia,
     para cualquier página que cargue este archivo, sin que cada página
     tenga que acordarse de hacerlo. */
  var _claimsUnsub = null;
  function watchClaimsRefresh(user) {
    if (_claimsUnsub) { _claimsUnsub(); _claimsUnsub = null; }
    if (!user || typeof window.r3adsDb === 'undefined') return;
    var first = true; // onSnapshot dispara de inmediato con el estado actual
    _claimsUnsub = window.r3adsDb.collection('_claimsRefresh').doc(user.uid)
      .onSnapshot(function (snap) {
        if (first) { first = false; return; }
        if (!snap.exists) return;
        user.getIdToken(true)
          .then(function () { window.location.reload(); })
          .catch(function () {});
      }, function () { /* sin acceso o error de red: no bloquea la página */ });
  }
  if (typeof window.r3adsAuth !== 'undefined') {
    window.r3adsAuth.onAuthStateChanged(function (user) { watchClaimsRefresh(user); });
  }

  function userDoc(uid, cb) {
    var db = typeof window.r3adsDb !== 'undefined' ? window.r3adsDb : null;
    if (!db) { cb(null); return; }
    db.collection('usuarios').doc(uid).get()
      .then(function (doc) {
        cb(doc.exists && doc.data().estado === 'activo' ? doc.data() : null);
      })
      .catch(function () { cb(null); });
  }

  global.r3adsStaff = {
    checkAdmin: function (user, clinicId, cb) {
      if (!user) { cb(false); return; }
      userDoc(user.uid, function (data) {
        cb(!!data && data.clinicId === clinicId && data.rol === 'admin');
      });
    },
    checkStaff: function (user, clinicId, cb) {
      if (!user) { cb(false); return; }
      userDoc(user.uid, function (data) {
        cb(!!data && data.clinicId === clinicId);
      });
    },
    // checkDoctor: acceso al portal clínico (Expediente-Doctor.html). Mismo
    // criterio que isDoctor() en firestore.rules: rol medico | enf | admin.
    checkDoctor: function (user, clinicId, cb) {
      if (!user) { cb(false); return; }
      userDoc(user.uid, function (data) {
        cb(!!data && data.clinicId === clinicId && ['medico', 'enf', 'admin'].indexOf(data.rol) !== -1);
      });
    },
    // checkMedico: SOLO médico (rol medico | admin). Igual que
    // isMedicoTratante() en firestore.rules — enfermería (rol enf) no pasa.
    // Se usa para ocultar/bloquear en el cliente la Etapa de Consulta médica
    // (diagnóstico/tratamiento), reservada al médico tratante o un admin.
    checkMedico: function (user, clinicId, cb) {
      if (!user) { cb(false); return; }
      userDoc(user.uid, function (data) {
        cb(!!data && data.clinicId === clinicId && ['medico', 'admin'].indexOf(data.rol) !== -1);
      });
    },
    // checkSuperAdmin: cuenta interna de R3ads (custom claim del token, no
    // depende de /usuarios ni de ninguna clínica). Solo para el panel de
    // administración de R3ads — nunca dentro de una clínica.
    checkSuperAdmin: function (user, cb) {
      if (!user) { cb(false); return; }
      user.getIdTokenResult()
        .then(function (token) { cb(token.claims.superadmin === true); })
        .catch(function () { cb(false); });
    }
  };
})(window);
