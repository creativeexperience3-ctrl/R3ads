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

/**
 * crearClinicaSelfService (callable): alta de clínica por auto-registro,
 * sin pasar por el superadmin de R3ads (portal-admin.html). Reemplaza,
 * para este camino, al patrón manual de Admin-Usuarios.html/portal-admin
 * (superadmin crea /clinics, luego crea el primer /usuarios admin) — acá
 * ambos pasos ocurren en un solo paso, disparados por el propio usuario ya
 * autenticado (ver Auth.html, vista "Crea tu clínica").
 *
 * Usa el Admin SDK a propósito: firestore.rules NO deja escribir /clinics
 * ni crear /usuarios a nadie que no sea ya superadmin o admin de esa
 * clínica (círculo cerrado — nadie puede auto-nombrarse admin de una
 * clínica que no existe). Esta función es la única puerta para romper ese
 * círculo, y solo hace dos cosas, nunca más: crear la clínica que pide
 * quien llama, y volverlo admin de ESA clínica y de ninguna otra.
 *
 * Decisión de producto (2026-09-24): la clínica queda 'activa' de
 * inmediato (prueba gratis), sin exigir pago — el cobro con PayPal
 * (Fase 6) se conecta después. `origenAlta: 'self-service'` queda
 * marcado para que esa fase pueda distinguir estas clínicas de las dadas
 * de alta a mano y decidir qué pasa si la prueba no se convierte en pago.
 */
const PLAN_BASICO_MODULOS = {
  laboratorio: false,
  pruebasRapidas: false,
  constancias: true,
  ekg: false,
  historialCalendario: false
};

function slugify(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'clinica';
}

exports.crearClinicaSelfService = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión para crear una clínica.');
  }
  const uid = context.auth.uid;
  const authEmail = context.auth.token.email || '';

  const nombreClinica = String((data && data.nombreClinica) || '').trim().slice(0, 120);
  const prefijo = String((data && data.prefijoCodigoPaciente) || '').trim().toUpperCase().slice(0, 8);
  const nombreAdmin = String((data && data.nombreAdmin) || '').trim().slice(0, 120);

  if (!nombreClinica) {
    throw new functions.https.HttpsError('invalid-argument', 'Falta el nombre de la clínica.');
  }
  if (!prefijo) {
    throw new functions.https.HttpsError('invalid-argument', 'Falta el prefijo de código de paciente.');
  }

  // Un uid solo pasa por acá una vez: si ya tiene /usuarios/{uid} (staff de
  // otra clínica, o ya se autoregistró antes), no se le deja pisar su
  // propio clinicId ni crear una segunda clínica encima de su cuenta.
  const usuarioRef = db.collection('usuarios').doc(uid);
  const usuarioSnap = await usuarioRef.get();
  if (usuarioSnap.exists) {
    throw new functions.https.HttpsError('already-exists', 'Esta cuenta ya pertenece a una clínica.');
  }

  const base = slugify(nombreClinica);
  const MAX_INTENTOS = 30;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const candidato = intento === 0 ? base : `${base}-${intento + 1}`;
    const clinicRef = db.collection('clinics').doc(candidato);
    try {
      await db.runTransaction(async (tx) => {
        const clinicSnap = await tx.get(clinicRef);
        if (clinicSnap.exists) {
          throw new Error('SLUG_TOMADO');
        }
        const ahora = admin.firestore.FieldValue.serverTimestamp();
        tx.set(clinicRef, {
          nombre: nombreClinica,
          razonSocial: nombreClinica,
          prefijoCodigoPaciente: prefijo,
          subdominio: candidato,
          direccion: '',
          ciudad: '',
          telefono: '',
          whatsapp: '',
          correo: authEmail,
          sitioWeb: '',
          modulos: PLAN_BASICO_MODULOS,
          estado: 'activa',
          origenAlta: 'self-service',
          creadoEn: ahora
        });
        tx.set(usuarioRef, {
          nombre: nombreAdmin || (authEmail ? authEmail.split('@')[0] : 'Admin'),
          email: authEmail,
          rol: 'admin',
          estado: 'activo',
          clinicId: candidato,
          uid: uid,
          creadoEn: ahora
        });
      });
      return { clinicId: candidato };
    } catch (err) {
      if (err.message === 'SLUG_TOMADO') continue;
      console.error('[crearClinicaSelfService] Error creando clínica para', uid, err);
      throw new functions.https.HttpsError('internal', 'No se pudo crear la clínica. Intenta de nuevo.');
    }
  }
  throw new functions.https.HttpsError('already-exists', 'No se pudo generar un identificador único para la clínica. Prueba con otro nombre.');
});
