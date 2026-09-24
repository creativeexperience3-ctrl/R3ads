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
 * Decisión de producto (2026-09-24, revisada el mismo día): la clínica
 * NACE en `estado: 'prueba_bloqueada'` — puede iniciar sesión y mirar el
 * sistema, pero clinicActiva() en firestore.rules exige 'activa' para
 * leer/escribir cualquier dato clínico real, así que en la práctica solo
 * puede ver el cascarón vacío hasta activar su prueba. La activación
 * (agregar tarjeta vía PayPal, ver crearSuscripcionPayPal más abajo) es
 * lo único que la pasa a 'activa' — eso dispara el ciclo de prueba de 7
 * días en $0 que ya trae el Billing Plan de PayPal, y al día 8 PayPal
 * cobra solo el plan elegido acá. `origenAlta: 'self-service'` queda
 * marcado para distinguir estas clínicas de las dadas de alta a mano.
 */
const PLAN_BASICO_MODULOS = {
  laboratorio: false,
  pruebasRapidas: false,
  constancias: true,
  ekg: false,
  historialCalendario: false
};
const PLAN_COMPLETO_MODULOS = {
  laboratorio: true,
  pruebasRapidas: true,
  constancias: true,
  ekg: true,
  historialCalendario: true
};
// Mismos IDs que imprimió scripts/setup-paypal-plans.js al crear el
// Producto y los Billing Plans en PayPal Sandbox (2026-09-24). Cambian
// solo si se recrean los planes (ej. al pasar a Live) — no son secretos,
// son identificadores públicos del catálogo de PayPal.
const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com'; // TODO Fase Live: https://api-m.paypal.com + nuevos IDs de plan
const PAYPAL_PLAN_IDS = {
  basico: 'P-4J942821SL9562706NK2UZCY',
  completo: 'P-4KR215680L6922628NK2UZDA'
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
  const planElegido = PAYPAL_PLAN_IDS[(data && data.plan)] ? data.plan : 'basico';
  const modulosDelPlan = planElegido === 'completo' ? PLAN_COMPLETO_MODULOS : PLAN_BASICO_MODULOS;

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
          modulos: modulosDelPlan,
          planElegido: planElegido,
          estado: 'prueba_bloqueada',
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

/* ============================================================
   PayPal — activación de prueba con tarjeta (Fase 6)

   Dos piezas:
   - crearSuscripcionPayPal (callable): el admin de una clínica en
     'prueba_bloqueada' la llama para iniciar la suscripción del plan que
     eligió al registrarse. Devuelve el enlace de aprobación de PayPal —
     el cliente redirige el navegador ahí; la tarjeta la captura PayPal,
     nunca este sistema.
   - paypalWebhook (HTTPS): PayPal nos avisa aquí cuando el suscriptor
     aprueba (arranca el ciclo de prueba de 7 días en $0) o cuando un
     cobro falla/se cancela. Es la ÚNICA fuente de verdad para activar o
     suspender — nunca el redirect de vuelta del navegador, que cualquiera
     podría visitar a mano con un subscriptionId inventado.
   ============================================================ */

async function paypalToken() {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(
        `${process.env.PAYPAL_SANDBOX_CLIENT_ID}:${process.env.PAYPAL_SANDBOX_CLIENT_SECRET}`
      ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo autenticar con PayPal: ' + JSON.stringify(data));
  return data.access_token;
}

exports.crearSuscripcionPayPal = functions
  .runWith({ secrets: ['PAYPAL_SANDBOX_CLIENT_ID', 'PAYPAL_SANDBOX_CLIENT_SECRET'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    const usuarioSnap = await db.collection('usuarios').doc(context.auth.uid).get();
    if (!usuarioSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Esta cuenta no pertenece a ninguna clínica.');
    }
    const usuario = usuarioSnap.data();
    if (usuario.rol !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Solo el admin de la clínica puede activar la suscripción.');
    }

    const clinicRef = db.collection('clinics').doc(usuario.clinicId);
    const clinicSnap = await clinicRef.get();
    if (!clinicSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'No se encontró la clínica.');
    }
    const clinic = clinicSnap.data();
    const planKey = PAYPAL_PLAN_IDS[clinic.planElegido] ? clinic.planElegido : 'basico';

    const returnUrl = (data && data.returnUrl) || 'https://ancla.r3ads.com/Auth.html?activacion=ok';
    const cancelUrl = (data && data.cancelUrl) || 'https://ancla.r3ads.com/Auth.html?activacion=cancelada';

    let token;
    try {
      token = await paypalToken();
    } catch (err) {
      console.error('[crearSuscripcionPayPal] Error de autenticación con PayPal', err);
      throw new functions.https.HttpsError('internal', 'No se pudo conectar con PayPal. Intenta de nuevo.');
    }

    const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: PAYPAL_PLAN_IDS[planKey],
        // custom_id es lo que el webhook usa para saber a qué clínica
        // activar/suspender — ver clinicRefForEvent() más abajo.
        custom_id: usuario.clinicId,
        subscriber: { email_address: usuario.email },
        application_context: {
          brand_name: 'Ancla',
          locale: 'es-HN',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl
        }
      })
    });
    const sub = await res.json();
    if (!res.ok) {
      console.error('[crearSuscripcionPayPal] Error creando suscripción', sub);
      throw new functions.https.HttpsError('internal', 'No se pudo iniciar la suscripción con PayPal.');
    }

    const approveLink = (sub.links || []).find((l) => l.rel === 'approve');
    if (!approveLink) {
      console.error('[crearSuscripcionPayPal] PayPal no devolvió enlace de aprobación', sub);
      throw new functions.https.HttpsError('internal', 'PayPal no devolvió un enlace de aprobación.');
    }

    await clinicRef.update({ paypalSubscriptionId: sub.id });
    return { approveUrl: approveLink.href, subscriptionId: sub.id };
  });

/* clinicRefForEvent: identifica a qué clínica pertenece un evento de
   webhook. Primero por custom_id (presente en eventos BILLING.SUBSCRIPTION.*
   porque lo fijamos nosotros al crear la suscripción); si el evento es de
   pago (PAYMENT.SALE.*) y no trae custom_id, cae a buscar por
   paypalSubscriptionId == billing_agreement_id, que es como PayPal
   referencia la suscripción dueña de ese cobro. */
async function clinicRefForEvent(resource) {
  if (resource.custom_id) {
    const ref = db.collection('clinics').doc(resource.custom_id);
    if ((await ref.get()).exists) return ref;
  }
  const subId = resource.billing_agreement_id
    || (typeof resource.id === 'string' && resource.id.startsWith('I-') ? resource.id : null);
  if (subId) {
    const q = await db.collection('clinics').where('paypalSubscriptionId', '==', subId).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  return null;
}

exports.paypalWebhook = functions
  .runWith({ secrets: ['PAYPAL_SANDBOX_CLIENT_ID', 'PAYPAL_SANDBOX_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'] })
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

    try {
      const token = await paypalToken();
      const verifyRes = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_algo: req.headers['paypal-auth-algo'],
          cert_url: req.headers['paypal-cert-url'],
          transmission_id: req.headers['paypal-transmission-id'],
          transmission_sig: req.headers['paypal-transmission-sig'],
          transmission_time: req.headers['paypal-transmission-time'],
          webhook_id: process.env.PAYPAL_WEBHOOK_ID,
          webhook_event: req.body
        })
      });
      const verify = await verifyRes.json();
      if (verify.verification_status !== 'SUCCESS') {
        console.error('[paypalWebhook] Firma inválida', verify);
        res.status(400).send('Firma inválida');
        return;
      }

      const event = req.body || {};
      const resource = event.resource || {};

      switch (event.event_type) {
        case 'BILLING.SUBSCRIPTION.ACTIVATED': {
          const ref = await clinicRefForEvent(resource);
          if (ref) await ref.update({ estado: 'activa' });
          break;
        }
        case 'BILLING.SUBSCRIPTION.CANCELLED':
        case 'BILLING.SUBSCRIPTION.SUSPENDED':
        case 'BILLING.SUBSCRIPTION.EXPIRED':
        case 'PAYMENT.SALE.DENIED': {
          const ref = await clinicRefForEvent(resource);
          if (ref) await ref.update({ estado: 'suspendida' });
          break;
        }
        default:
          break; // otros eventos (PAYMENT.SALE.COMPLETED, etc.) no cambian el estado — ACTIVATED ya desbloqueó el acceso.
      }

      res.status(200).send('OK');
    } catch (err) {
      console.error('[paypalWebhook] Error procesando evento', err);
      res.status(500).send('Error interno');
    }
  });
