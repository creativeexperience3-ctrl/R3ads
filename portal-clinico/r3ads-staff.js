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
  /* ── Segundo factor vencido ────────────────────────────────────
     Los claims `mfa`/`mfaUntil` los fija verificar2FA (functions/index.js)
     y los exige firestore.rules (mfaVigente) dentro de sameClinic(), por
     donde pasan todos los roles. Pasadas las 12 horas, Firestore deja de
     responder: sin esto el usuario vería "missing or insufficient
     permissions" en cada pantalla, sin ninguna pista de que lo único que
     necesita es volver a meter su código.

     Solo actúa sobre quien YA activó su 2FA (claim mfa == true). Quien no
     lo activó no tiene el claim y esto no lo toca nunca.

     Antes de redirigir se fuerza UN refresh del token: si el usuario
     acaba de verificarse en otra pestaña, el token cacheado de esta
     todavía diría que venció y lo mandaríamos a Auth.html sin necesidad. */
  var _mfaRedirigiendo = false;

  function checkMfaVigente(user) {
    if (!user || _mfaRedirigiendo) return;

    function vencido(claims) {
      return claims && claims.mfa === true && Number(claims.mfaUntil || 0) <= Date.now();
    }
    function aVerificar() {
      _mfaRedirigiendo = true;
      var pagina = window.location.pathname.split('/').pop() || 'Inicio.html';
      window.location.href = 'Auth.html?returnTo=' + encodeURIComponent(pagina + window.location.search);
    }

    user.getIdTokenResult()
      .then(function (res) {
        if (!vencido(res && res.claims)) return null;
        return user.getIdTokenResult(true).then(function (fresco) {
          if (vencido(fresco && fresco.claims)) aVerificar();
        });
      })
      /* Un fallo acá no debe sacar a nadie de la página: firestore.rules
         sigue siendo la que decide, así que en el peor caso el usuario ve
         un error de permisos en vez de un redirect — nunca lo contrario. */
      .catch(function () {});
  }

  if (typeof window.r3adsAuth !== 'undefined') {
    window.r3adsAuth.onAuthStateChanged(function (user) {
      watchClaimsRefresh(user);
      checkMfaVigente(user);
    });
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

  /* ── Bitácora de acceso a expedientes (2026-10-02) ──────────────
     Deja constancia de quién abrió, exportó o descargó el expediente de un
     paciente. Antes no quedaba rastro de ninguna lectura: ante un reclamo
     de filtración no había forma de decir quién lo vio, ni de demostrar que
     nadie lo vio.

     Tres decisiones que vale la pena entender antes de tocar esto:

     1. Nunca rechaza ni demora lo que el usuario está haciendo. Si la
        escritura falla —sin red, reglas, lo que sea— se anota en consola y
        la página sigue. Una bitácora que impide atender a un paciente se
        apaga el primer día, y entonces no hay bitácora.
     2. Deduplica por (código, acción) durante 10 minutos dentro de la misma
        carga de página. Sin esto, cada re-render de una pestaña escribiría
        otra entrada y la bitácora terminaría siendo ilegible y cara.
     3. No guarda datos clínicos, solo quién-qué-cuándo. La bitácora se
        conserva más tiempo que su utilidad inmediata; no tiene sentido que
        además duplique información del expediente. */
  var ACCESO_DEDUPE_MS = 10 * 60 * 1000;
  var _accesosRecientes = {}; /* 'codigo|accion' -> timestamp */

  function registrarAcceso(clinicId, codigoPaciente, accion, extra) {
    try {
      var user = global.r3adsAuth && global.r3adsAuth.currentUser;
      if (!user || !clinicId || !codigoPaciente) return;

      var llave = codigoPaciente + '|' + accion;
      var ahora = Date.now();
      if (_accesosRecientes[llave] && ahora - _accesosRecientes[llave] < ACCESO_DEDUPE_MS) return;
      _accesosRecientes[llave] = ahora;

      /* El rol sale del token ya cacheado (getIdTokenResult sin forzar no
         va a la red), no de una lectura extra de /usuarios: la bitácora no
         debería costar un read por cada expediente que alguien abre. */
      user.getIdTokenResult().then(function (token) {
        var entrada = {
          clinicId: clinicId,
          codigoPaciente: codigoPaciente,
          accion: accion,
          uid: user.uid,
          email: user.email || '',
          rol: (token && token.claims && token.claims.rol) || '',
          origen: 'portal-clinico',
          ts: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (extra && extra.detalle) entrada.detalle = String(extra.detalle).slice(0, 200);
        return global.r3adsDb.collection('accesos').add(entrada);
      }).catch(function (err) {
        console.error('[Ancla] No se pudo registrar el acceso en la bitácora:', err);
      });
    } catch (err) {
      console.error('[Ancla] Error inesperado al registrar el acceso:', err);
    }
  }

  global.r3adsStaff = {
    registrarAcceso: registrarAcceso,
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
    },
    // resolveClinicId: clinicId de la SESIÓN (custom claim del token) —
    // fuente de verdad de qué clínica ve cada página. Reemplaza al viejo
    // window.R3ADS_CLINIC_ID estático (clinic-config.js), que solo servía
    // mientras existía una sola clínica desplegada. Mismo claim que ya
    // validan firestore.rules (myClinic() = request.auth.token.clinicId).
    //
    // Si el token NO trae clinicId se fuerza UN refresh antes de rendirse.
    // Motivo: el ID token se cachea hasta una hora, así que el minteado
    // ANTES de que onUsuarioWrite fijara los claims no los tiene — que es
    // exactamente el primer login después de crear una clínica, el caso más
    // común del alta self-service. Sin este refresh, resolveClinicId devuelve
    // null, checkStaff compara contra null y falla, y el usuario ve "Acceso
    // restringido" en su propia clínica recién creada, sin más salida que
    // cerrar sesión y volver a entrar (o esperar a que el token expire solo).
    // watchClaimsRefresh no lo cubre: ignora el primer snapshot a propósito,
    // así que solo reacciona a cambios ocurridos con la página ya abierta.
    //
    // Se refresca solo cuando falta el claim, o sea como mucho una vez por
    // carga de página, y únicamente para cuentas que hoy no resuelven nada.
    resolveClinicId: function (user, cb) {
      if (!user) { cb(null); return; }
      user.getIdTokenResult()
        .then(function (token) {
          if (token.claims.clinicId) { cb(token.claims.clinicId); return null; }
          return user.getIdTokenResult(true).then(function (fresco) {
            // Si tampoco viene acá, la cuenta de verdad no pertenece a
            // ninguna clínica — no es un token viejo.
            cb((fresco && fresco.claims && fresco.claims.clinicId) || null);
          });
        })
        .catch(function () { cb(null); });
    }
  };
})(window);
