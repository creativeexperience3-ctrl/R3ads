/* ============================================================
   R3ads Portal Clínico — Cloud Functions

   Fase 3 del plan: fija los custom claims de Firebase Auth
   (`clinicId`, `rol`) a partir del documento /usuarios/{uid} en
   Firestore. Sin esto, firestore.rules y storage.rules no tienen de
   dónde leer request.auth.token.clinicId / .rol — son la única fuente
   de verdad de a qué clínica pertenece cada usuario y qué rol tiene.

   Usa el namespace v1 de firebase-functions a propósito (API estable,
   bien documentada) en vez de la v2 por defecto — evita depender de
   detalles más nuevos/cambiantes de la superficie v2 para algo tan
   crítico como esto.
   ============================================================ */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

/**
 * onWrite en /usuarios/{uid}:
 *   - create/update: castea clinicId + rol (solo si estado === 'activo';
 *     si no, el claim `rol` queda en null y todas las reglas basadas en
 *     rol fallan para ese usuario, aunque siga teniendo clinicId).
 *   - delete: limpia los claims por completo.
 *
 * Después de fijar los claims, escribe en /_claimsRefresh/{uid} — los
 * clientes escuchan ese doc (ver r3ads-staff.js) y fuerzan un refresh de
 * su ID token cuando cambia. Sin esto, un usuario recién creado o con el
 * rol recién cambiado no vería el efecto hasta que su token expire solo
 * (hasta 1 hora) o cierre y vuelva a iniciar sesión.
 */
exports.onUsuarioWrite = functions.firestore
  .document('usuarios/{uid}')
  .onWrite(async (change, context) => {
    const uid = context.params.uid;

    if (!change.after.exists) {
      try {
        await admin.auth().setCustomUserClaims(uid, null);
      } catch (err) {
        console.error('[onUsuarioWrite] Error limpiando claims de', uid, err);
      }
      return null;
    }

    const data = change.after.data() || {};
    const clinicId = data.clinicId || null;
    const rol = data.estado === 'activo' ? (data.rol || null) : null;

    let user;
    try {
      user = await admin.auth().getUser(uid);
    } catch (err) {
      // El doc de Firestore puede haberse creado antes de que exista la
      // cuenta de Auth en algún flujo futuro — no es un error fatal aquí,
      // simplemente no hay claims que fijar todavía.
      console.warn('[onUsuarioWrite] No existe cuenta de Auth para', uid, err.message);
      return null;
    }

    const current = user.customClaims || {};
    if (current.clinicId === clinicId && current.rol === rol) {
      return null; // sin cambios reales — evita escrituras/refrescos innecesarios
    }

    try {
      await admin.auth().setCustomUserClaims(uid, { clinicId: clinicId, rol: rol });
    } catch (err) {
      console.error('[onUsuarioWrite] Error fijando claims de', uid, err);
      return null;
    }

    return db.collection('_claimsRefresh').doc(uid).set({
      refreshedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
