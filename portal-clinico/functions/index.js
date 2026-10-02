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

    /* setCustomUserClaims REEMPLAZA el conjunto entero de claims. Los que no
       salen de /usuarios hay que arrastrarlos a mano:
         · mfa / mfaUntil — el segundo factor (ver el bloque 2FA al final).
           Sin esto, cualquier escritura en /usuarios/{uid} (cambiar un rol,
           desactivar y reactivar a alguien) le apagaría el 2FA al usuario sin
           que nadie se enterara, y firestore.rules volvería a dejarlo pasar
           con sola la contraseña.
         · superadmin — se otorga una sola vez por Admin SDK y no vive en
           ningún doc, así que también se perdía en la primera escritura. */
    const nuevosClaims = { clinicId: clinicId, rol: rol };
    if (current.mfa === true) {
      nuevosClaims.mfa = true;
      nuevosClaims.mfaUntil = current.mfaUntil || 0;
    }
    if (current.superadmin === true) nuevosClaims.superadmin = true;

    try {
      await admin.auth().setCustomUserClaims(uid, nuevosClaims);
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
// Mismos IDs que imprimió el script de setup al crear el Producto y los
// Billing Plans en PayPal Sandbox. Cambian solo si se recrean los planes
// (ej. al pasar a Live, o al cambiar de precio) — no son secretos, son
// identificadores públicos del catálogo de PayPal.
//
// Precio Fundador (2026-09-24): Básico $40/mes, Completo $65/mes — para
// las primeras clínicas que se registren. Los planes originales a
// $75/$99 (P-4J942821SL9562706NK2UZCY / P-4KR215680L6922628NK2UZDA)
// siguen existiendo en PayPal por si algún día se necesita volver a
// ellos, pero ya no se usan para altas nuevas.
//
// Pasado a LIVE (2026-09-26): IDs de Sandbox (P-8A723034MA5250942NK2VL7I /
// P-1KB25418PC537783SNK2VL7I) reemplazados por los de Live, creados con
// functions/crear-planes-paypal-live.js — no son intercambiables, un plan
// de Sandbox no existe en Live ni viceversa.
const PAYPAL_API_BASE = 'https://api-m.paypal.com';
const PAYPAL_PLAN_IDS = {
  basico: 'P-0WX001956C216161VNK36XBI',
  completo: 'P-3M884515R5435801MNK36XBI'
};

function slugify(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'clinica';
}

/* ════════════════════════════════════════════════════════════════
   APP CHECK EN "APLICAR" — POR FUNCIÓN, NO POR TODAS (2026-09-29)

   App Check estaba registrado desde el 2026-09-26 pero en modo monitoreo:
   nada impedía que un bot o un script golpeara estas funciones. Acá se
   pasa a exigirlo (`enforceAppCheck: true`) SOLO en las que el abuso
   automatizado es la amenaza real, y se deja fuera a propósito todo lo
   que está en un camino de entrada o de recuperación.

   SE EXIGE en:
     · crearClinicaSelfService  — alta de clínicas: sin esto, un script
       puede crear clínicas sin límite.
     · crearSuscripcionPayPal / revisarSuscripcionPayPal — todo lo que
       toca dinero.
     · registrarIntentoLogin — es el único endpoint sin autenticar que
       ESCRIBE: un bot podía sumar intentos fallidos contra el correo de
       cualquiera y dejarlo bloqueado 15 minutos (una negación de servicio
       sobre el login ajeno). Exigirlo acá NO puede impedir un login: si
       la llamada falla, Auth.html solo pierde el contador y muestra el
       error de Firebase; el signIn ya ocurrió por su cuenta.

   NO se exige en (y no es un olvido):
     · verificar2FA — si App Check fallara, un usuario con segundo factor
       activo no podría terminar de entrar NUNCA. El segundo factor no
       puede depender de que reCAPTCHA le dé un buen puntaje.
     · registrarLoginExitoso, verificarCodigoReset — limpian el bloqueo de
       login y completan un reset de contraseña. Son caminos de
       recuperación: bloquearlos deja a alguien afuera de su cuenta.
     · cancelarSuscripcionPayPal — si un cliente no puede cancelar, abre
       una disputa en PayPal, que es justo el riesgo que hay que evitar.
     · el resto de las funciones de 2FA — ya exigen sesión y tienen su
       propio límite de intentos.
     · paypalWebhook — lo llama PayPal, servidor a servidor. No hay
       navegador ni token de App Check posible.

   Ojo: esto es independiente de pasar Firestore / Storage / Auth a
   "Aplicar" en la consola de App Check, que es otra decisión y tiene otro
   radio de impacto (ver RESPALDOS.md y las métricas del 2026-09-29:
   Firestore venía con 8% de tráfico sin verificar por el bug de
   activación que se arregló hoy).
   ════════════════════════════════════════════════════════════════ */

/* Subcolecciones de /clinics/{id} y colecciones de nivel raíz que llevan el
   clinicId como CAMPO. Juntas son todo lo que puede sobrevivir a una clínica
   dada de baja. */
const SUBCOLECCIONES_CLINICA = ['personal', 'catalogoConfig', 'siteConfig', 'medicamentos'];
const COLECCIONES_POR_CLINIC_ID = [
  'usuarios', 'expedientes', 'consultas', 'resultadosPruebas',
  'examenesLaboratorio', 'constancias', 'electrocardiogramas', 'referencias',
];

/* ¿Queda algo de un tenant anterior bajo este id?

   Borrar /clinics/{id} en Firestore NO borra sus subcolecciones — siguen
   existiendo aunque el documento padre desaparezca. Y las colecciones de
   nivel raíz ni siquiera cuelgan de ahí: se filtran por el CAMPO clinicId.
   O sea que dar de baja una clínica deja atrás su personal, su catálogo y
   —lo grave— sus expedientes y consultas.

   Como el id sale de slugificar el nombre, dos clínicas con nombres
   parecidos producen el mismo slug. Si la primera se dio de baja, la
   segunda encontraba /clinics/{slug} vacío, lo creaba, y HEREDABA todo lo
   que la anterior dejó. En un sistema de expedientes médicos eso es
   entregarle los pacientes de una clínica a otra.

   Pasó de verdad y por eso existe esta función: clinica-r3ads se creó el
   2026-09-29 y ya traía personal del 2026-09-24, de una prueba anterior con
   el mismo nombre.

   Son ~12 lecturas por candidato, y normalmente hay un solo candidato. */
async function slugTieneRestos(candidato) {
  for (const sub of SUBCOLECCIONES_CLINICA) {
    const snap = await db.collection('clinics').doc(candidato).collection(sub).limit(1).get();
    if (!snap.empty) return true;
  }
  for (const col of COLECCIONES_POR_CLINIC_ID) {
    const snap = await db.collection(col).where('clinicId', '==', candidato).limit(1).get();
    if (!snap.empty) return true;
  }
  return false;
}

/* Versión de los Términos del Servicio (portal-clinico/Terminos.html) que
   está vigente. Subirla al publicar una revisión sustancial: lo que queda
   grabado en /clinics/{id}.aceptacion es esta cadena, y es lo que permite
   saber después qué texto aceptó cada clínica. */
const TERMINOS_VERSION = '2026-10-02';

exports.crearClinicaSelfService = functions
  .runWith({ enforceAppCheck: true })
  .https.onCall(async (data, context) => {
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
  /* Aceptación de los Términos del Servicio y su Anexo A (encargado del
     tratamiento). Se exige acá y no solo en la casilla de Auth.html porque
     esta función es el único camino para crear una clínica: lo que quede
     escrito en /clinics es la constancia de que hubo contrato, y una
     constancia que el cliente podría saltarse no sirve de constancia. */
  if (!(data && data.aceptaTerminos === true)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Hay que aceptar los Términos del Servicio y la Política de Privacidad para crear la clínica.'
    );
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

    /* Que no exista /clinics/{candidato} NO significa que el id esté libre
       (ver slugTieneRestos). Si quedó cualquier rastro de un tenant anterior
       con ese mismo id, se pasa al siguiente candidato en vez de heredarlo. */
    if (await slugTieneRestos(candidato)) continue;

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
          /* Constancia del contrato: qué versión del texto se aceptó, quién
             la aceptó y cuándo. La versión importa — "aceptó los términos"
             no dice nada si no se sabe cuáles. Se escribe acá, con el Admin
             SDK, así que no depende de lo que mande el cliente salvo el
             propio consentimiento. */
          aceptacion: {
            terminos: TERMINOS_VERSION,
            uid: uid,
            email: authEmail,
            fecha: ahora
          },
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
        `${process.env.PAYPAL_LIVE_CLIENT_ID}:${process.env.PAYPAL_LIVE_CLIENT_SECRET}`
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
  .runWith({ secrets: ['PAYPAL_LIVE_CLIENT_ID', 'PAYPAL_LIVE_CLIENT_SECRET'], enforceAppCheck: true })
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

    // plan (opcional): permite elegir/cambiar el plan justo antes de activar
    // o reactivar (ver Mi-Suscripcion.html) sin un paso aparte — si no viene,
    // se mantiene el comportamiento original (usa el plan ya guardado en la
    // clínica, elegido al registrarse). Se persiste ANTES de llamar a PayPal
    // para que planElegido/modulos ya reflejen la elección aunque el admin
    // abandone la aprobación de PayPal a mitad de camino.
    const planPedido = data && PAYPAL_PLAN_IDS[data.plan] ? data.plan : null;
    if (planPedido && planPedido !== clinic.planElegido) {
      const modulosDelPlanPedido = planPedido === 'completo' ? PLAN_COMPLETO_MODULOS : PLAN_BASICO_MODULOS;
      await clinicRef.update({ planElegido: planPedido, modulos: modulosDelPlanPedido });
      clinic.planElegido = planPedido;
    }
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

/* ============================================================
   PayPal — cambio de plan y cancelación (Mi perfil / Suscripción)

   Dos piezas nuevas, mismo patrón que crearSuscripcionPayPal (admin de la
   clínica, secrets vía runWith, paypalToken() compartido):

   - revisarSuscripcionPayPal: cambia el plan (Básico <-> Completo) de una
     suscripción YA activa, vía POST .../subscriptions/{id}/revise — no crea
     una suscripción nueva ni vuelve a pedir tarjeta, reutiliza la forma de
     pago ya aprobada. Para un cambio de plan simple (mismo suscriptor,
     misma moneda) sobre una suscripción activa, PayPal aplica el cambio de
     inmediato sin pedirle nada más al pagador — por eso acá actualizamos
     planElegido/modulos apenas PayPal confirma. El caso borde en el que
     PayPal SÍ devuelve un link de aprobación (cambios más profundos, no
     esperado en este flujo) se deja explícito: no tocamos Firestore todavía
     y le devolvemos ese link al cliente para que el admin lo complete.
   - cancelarSuscripcionPayPal: POST .../subscriptions/{id}/cancel. A
     diferencia de revise, cancel es síncrono (PayPal responde 204 sin más
     pasos), así que acá SÍ marcamos estado:'cancelada' de una vez, sin
     esperar al webhook — paypalWebhook también lo marca al recibir
     BILLING.SUBSCRIPTION.CANCELLED (más abajo), como refuerzo redundante,
     no como única fuente de verdad (a diferencia de la activación, donde
     el webhook manda porque el redirect de vuelta lo podría visitar
     cualquiera con un id inventado — acá quien llama ya fue autenticado y
     verificado como admin de la clínica antes de tocar PayPal).

   'cancelada' es un estado nuevo, distinto de 'suspendida' (PayPal
   suspende/expira por un cobro fallido, sin que el admin lo pidiera).
   Ambos bloquean el acceso exactamente igual en firestore.rules
   (clinicActiva() solo exige 'activa') — la única diferencia es qué
   explicación ve el admin en el banner (ver clinic-trial-gate.js).
   ============================================================ */

function requireAdminUsuario(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }
  return db.collection('usuarios').doc(context.auth.uid).get().then((snap) => {
    if (!snap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Esta cuenta no pertenece a ninguna clínica.');
    }
    const usuario = snap.data();
    if (usuario.rol !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Solo el admin de la clínica puede administrar la suscripción.');
    }
    return usuario;
  });
}

exports.revisarSuscripcionPayPal = functions
  .runWith({ secrets: ['PAYPAL_LIVE_CLIENT_ID', 'PAYPAL_LIVE_CLIENT_SECRET'], enforceAppCheck: true })
  .https.onCall(async (data, context) => {
    const usuario = await requireAdminUsuario(context);

    const nuevoPlan = data && (data.nuevoPlan === 'completo' || data.nuevoPlan === 'basico') ? data.nuevoPlan : null;
    if (!nuevoPlan) {
      throw new functions.https.HttpsError('invalid-argument', 'Plan inválido.');
    }

    const clinicRef = db.collection('clinics').doc(usuario.clinicId);
    const clinicSnap = await clinicRef.get();
    if (!clinicSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'No se encontró la clínica.');
    }
    const clinic = clinicSnap.data();

    if (clinic.estado !== 'activa') {
      throw new functions.https.HttpsError('failed-precondition', 'Tu suscripción no está activa. Actívala antes de cambiar de plan.');
    }
    if (clinic.planElegido === nuevoPlan) {
      throw new functions.https.HttpsError('failed-precondition', 'Ya estás en ese plan.');
    }

    // Clínicas por transferencia (activadas a mano por WhatsApp, ver
    // portal-admin.html) no tienen suscripción de PayPal que revisar — no
    // hay cobro automático que ajustar, así que el cambio de plan es
    // directo. El camino de PayPal de acá para abajo queda intacto, esta
    // rama nunca lo toca.
    if (clinic.metodoPago === 'transferencia') {
      const modulosManual = nuevoPlan === 'completo' ? PLAN_COMPLETO_MODULOS : PLAN_BASICO_MODULOS;
      await clinicRef.update({ planElegido: nuevoPlan, modulos: modulosManual });
      return { requiereAprobacion: false };
    }

    if (!clinic.paypalSubscriptionId) {
      throw new functions.https.HttpsError('failed-precondition', 'No se encontró una suscripción de PayPal para esta clínica.');
    }

    let token;
    try {
      token = await paypalToken();
    } catch (err) {
      console.error('[revisarSuscripcionPayPal] Error de autenticación con PayPal', err);
      throw new functions.https.HttpsError('internal', 'No se pudo conectar con PayPal. Intenta de nuevo.');
    }

    const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${clinic.paypalSubscriptionId}/revise`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: PAYPAL_PLAN_IDS[nuevoPlan] })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[revisarSuscripcionPayPal] Error de PayPal al revisar la suscripción', err);
      throw new functions.https.HttpsError('internal', 'PayPal no pudo cambiar el plan. Intenta de nuevo.');
    }
    const revised = await res.json().catch(() => ({}));
    const approveLink = (revised.links || []).find((l) => l.rel === 'approve');
    if (approveLink) {
      // Caso infrecuente (ver nota arriba) — no tocamos planElegido/modulos
      // hasta que el admin complete esa aprobación.
      return { requiereAprobacion: true, approveUrl: approveLink.href };
    }

    const modulosDelPlan = nuevoPlan === 'completo' ? PLAN_COMPLETO_MODULOS : PLAN_BASICO_MODULOS;
    await clinicRef.update({ planElegido: nuevoPlan, modulos: modulosDelPlan });
    return { requiereAprobacion: false };
  });

exports.cancelarSuscripcionPayPal = functions
  .runWith({ secrets: ['PAYPAL_LIVE_CLIENT_ID', 'PAYPAL_LIVE_CLIENT_SECRET'] })
  .https.onCall(async (data, context) => {
    const usuario = await requireAdminUsuario(context);

    const clinicRef = db.collection('clinics').doc(usuario.clinicId);
    const clinicSnap = await clinicRef.get();
    if (!clinicSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'No se encontró la clínica.');
    }
    const clinic = clinicSnap.data();

    // Clínicas por transferencia: no hay suscripción de PayPal que cancelar
    // (no hay cobro automático corriendo). "Cancelar" acá es solo dejar de
    // estar habilitada — el camino de PayPal de acá para abajo no se toca.
    if (clinic.metodoPago === 'transferencia') {
      await clinicRef.update({ estado: 'cancelada', canceladaEn: admin.firestore.FieldValue.serverTimestamp() });
      return { ok: true };
    }

    if (!clinic.paypalSubscriptionId) {
      throw new functions.https.HttpsError('failed-precondition', 'No se encontró una suscripción de PayPal para esta clínica.');
    }

    let token;
    try {
      token = await paypalToken();
    } catch (err) {
      console.error('[cancelarSuscripcionPayPal] Error de autenticación con PayPal', err);
      throw new functions.https.HttpsError('internal', 'No se pudo conectar con PayPal. Intenta de nuevo.');
    }

    const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${clinic.paypalSubscriptionId}/cancel`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: (data && data.motivo) ? String(data.motivo).slice(0, 200) : 'Cancelado por el admin de la clínica desde Ancla.'
      })
    });

    // PayPal responde 204 sin cuerpo cuando cancela bien. Un 422 (ej.
    // SUBSCRIPTION_STATUS_INVALID) normalmente significa que ya estaba
    // cancelada/expirada del lado de PayPal — lo tratamos como éxito, porque
    // el resultado que quería el admin (dejar de pagar) ya es un hecho, en
    // vez de mostrarle un error confuso por algo que no puede resolver.
    if (!res.ok && res.status !== 422) {
      const err = await res.json().catch(() => ({}));
      console.error('[cancelarSuscripcionPayPal] Error de PayPal al cancelar', err);
      throw new functions.https.HttpsError('internal', 'PayPal no pudo cancelar la suscripción. Intenta de nuevo.');
    }

    await clinicRef.update({ estado: 'cancelada', canceladaEn: admin.firestore.FieldValue.serverTimestamp() });
    return { ok: true };
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
  .runWith({ secrets: ['PAYPAL_LIVE_CLIENT_ID', 'PAYPAL_LIVE_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'] })
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
        case 'BILLING.SUBSCRIPTION.CANCELLED': {
          // Refuerzo de cancelarSuscripcionPayPal (arriba) — llega también
          // cuando la cancelación la origina el propio PayPal o se hace
          // directo desde su panel, no solo desde Mi-Suscripcion.html.
          const ref = await clinicRefForEvent(resource);
          if (ref) await ref.update({ estado: 'cancelada' });
          break;
        }
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

/* ============================================================
   Rate limiting de login (2026-09-26)

   3 intentos fallidos por correo → bloqueado 15 minutos. El contador vive
   en /loginAttempts/{email en minúsculas}, escrito SOLO desde acá (Admin
   SDK) — firestore.rules le da lectura pública (para que Auth.html sepa
   si debe bloquear el intento ANTES de llamar a Firebase) pero
   `allow write: if false` a todo el mundo, porque si el cliente pudiera
   escribir ahí, cualquiera podría resetear su propio contador y el
   límite no serviría de nada.

   Dos formas de desbloquear antes de que pasen los 15 minutos:
   - registrarLoginExitoso: el login correcto ya prueba que es el dueño.
   - verificarCodigoReset: completar de verdad un reset de contraseña
     (no solo pedirlo — pedirlo no prueba nada, cualquiera puede pedir un
     reset para el correo de otro). Por eso Auth.html manda el link de
     reset a sí mismo (actionCodeSettings) en vez del hosted UI de
     Firebase, y llama a esta función con el oobCode ANTES de confirmar
     el cambio de contraseña.
   ============================================================ */
const LOGIN_LOCK_MINUTOS = 15;
const LOGIN_INTENTOS_MAX = 3;

function loginAttemptsRef(email) {
  return db.collection('loginAttempts').doc(String(email || '').trim().toLowerCase());
}

exports.registrarIntentoLogin = functions
  .runWith({ enforceAppCheck: true })
  .https.onCall(async (data, context) => {
  const email = String((data && data.email) || '').trim().toLowerCase();
  if (!email) throw new functions.https.HttpsError('invalid-argument', 'Falta el correo.');

  const ref = loginAttemptsRef(email);
  const ahora = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : { count: 0, lockedUntil: null };

    // Ya estaba bloqueado y el bloqueo sigue vigente — no sumar más, solo informar.
    if (d.lockedUntil && d.lockedUntil.toMillis() > ahora) {
      return { locked: true, lockedUntil: d.lockedUntil.toMillis(), intentosRestantes: 0 };
    }

    const nuevoCount = (d.lockedUntil && d.lockedUntil.toMillis() <= ahora ? 0 : (d.count || 0)) + 1;

    if (nuevoCount >= LOGIN_INTENTOS_MAX) {
      const lockedUntil = admin.firestore.Timestamp.fromMillis(ahora + LOGIN_LOCK_MINUTOS * 60 * 1000);
      tx.set(ref, { count: 0, lockedUntil, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return { locked: true, lockedUntil: lockedUntil.toMillis(), intentosRestantes: 0 };
    }

    tx.set(ref, { count: nuevoCount, lockedUntil: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { locked: false, lockedUntil: null, intentosRestantes: LOGIN_INTENTOS_MAX - nuevoCount };
  });
});

exports.registrarLoginExitoso = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.email) return { ok: true };
  await loginAttemptsRef(context.auth.token.email).delete().catch(() => {});
  return { ok: true };
});

/* verificarCodigoReset: se llama ANTES de confirmPasswordReset en el cliente.
   checkActionCode (a diferencia de applyActionCode) solo valida el código,
   no lo consume — así el cliente puede seguir usándolo justo después para
   completar el reset de verdad. Si el código no es válido (expirado, ya
   usado, inventado), esto lanza y el cliente nunca llega a desbloquear
   nada. */
exports.verificarCodigoReset = functions.https.onCall(async (data, context) => {
  const oobCode = String((data && data.oobCode) || '');
  if (!oobCode) throw new functions.https.HttpsError('invalid-argument', 'Falta el código.');

  let info;
  try {
    info = await admin.auth().checkActionCode(oobCode);
  } catch (err) {
    throw new functions.https.HttpsError('invalid-argument', 'El enlace de recuperación no es válido o ya expiró.');
  }

  const email = info.data && info.data.email;
  if (email) await loginAttemptsRef(email).delete().catch(() => {});
  return { ok: true, email: email || null };
});

/* ════════════════════════════════════════════════════════════════
   SEGUNDO FACTOR (2FA) POR TOTP — 2026-09-29

   Por qué a mano y no con el MFA nativo de Firebase: el MFA de Firebase
   Auth (TOTP y SMS) exige subir el proyecto a Identity Platform, que es
   un cambio de facturación y de superficie de Auth. Esto hace lo mismo
   con TOTP estándar (RFC 6238) — Google Authenticator, Authy, 1Password,
   Microsoft Authenticator y cualquier otra app sirven — sin tocar el plan.

   CÓMO SE HACE CUMPLIR DE VERDAD (lo importante)
   Un 2FA que solo esconde botones en el cliente no protege nada: quien
   tenga la contraseña puede hablarle a Firestore directo con el SDK y
   saltarse la interfaz entera. Acá el candado está en firestore.rules:

     · Al verificar el código, esta función fija dos custom claims en el
       token del usuario: `mfa: true` y `mfaUntil: <epoch ms>`.
     · firestore.rules exige, dentro de sameClinic() —por donde pasan TODOS
       los roles— que si el token trae `mfa == true`, entonces `mfaUntil`
       siga en el futuro. Ver mfaVigente() en ese archivo.
     · Pasadas MFA_VENTANA_HORAS el claim vence y Firestore deja de
       responder hasta que el usuario vuelva a meter un código.

   POR QUÉ NO PUEDE DEJAR A NADIE AFUERA
   mfaVigente() solo exige algo si el token YA trae `mfa == true`, o sea
   solo a quien terminó de activar su 2FA. Un usuario que nunca lo activó
   no tiene ese claim y las reglas se comportan igual que antes. Activar
   esto no puede bloquear a nadie que no se haya enrolado él mismo.

   RECUPERACIÓN
   Al activar se entregan MFA_CODIGOS_RECUPERACION códigos de un solo uso
   (se guardan solo como SHA-256, nunca en claro). Si además se pierden,
   el admin de la clínica o un superadmin resetea el 2FA del usuario con
   resetear2FAUsuario — nadie queda encerrado fuera de su propia cuenta.

   DÓNDE VIVE EL SECRETO
   /seguridad2FA/{uid}, colección con `allow read, write: if false` en
   firestore.rules: solo el Admin SDK (estas funciones) la toca. El
   cliente nunca ve el secreto después del enrolamiento. Se refleja un
   booleano `dosFactoresActivo` en /usuarios/{uid} —que sí es legible por
   el propio usuario y por el admin de su clínica— para que la interfaz
   sepa el estado sin poder leer nada sensible.
   ════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');

const MFA_VENTANA_HORAS        = 12;  /* cuánto dura una verificación */
const MFA_INTENTOS_MAX         = 5;   /* códigos errados antes de bloquear */
const MFA_LOCK_MINUTOS         = 15;
const MFA_CODIGOS_RECUPERACION = 8;
const MFA_DERIVA_PASOS         = 1;   /* ±1 paso de 30 s, por reloj desfasado */

function seguridad2FARef(uid) {
  return db.collection('seguridad2FA').doc(uid);
}

/* ─── Base32 (RFC 4648, sin padding) ──────────────────────────────
   Es el formato que piden las apps de autenticación para el secreto. */
const B32_ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += B32_ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += B32_ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

function base32Decode(texto) {
  const limpio = String(texto || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let valor = 0;
  const bytes = [];
  for (const c of limpio) {
    const idx = B32_ALFABETO.indexOf(c);
    if (idx === -1) continue;
    valor = (valor << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/* ─── TOTP (RFC 6238): HMAC-SHA1, 6 dígitos, pasos de 30 s ────────
   Implementado con el crypto de Node en vez de una dependencia nueva:
   son treinta líneas de un estándar cerrado, y así el login de segundo
   factor no queda atado a que alguien mantenga un paquete de npm. */
function totpCodigo(secretoBuf, contador) {
  const mensaje = Buffer.alloc(8);
  mensaje.writeUInt32BE(Math.floor(contador / 0x100000000), 0);
  mensaje.writeUInt32BE(contador % 0x100000000, 4);

  const hmac = crypto.createHmac('sha1', secretoBuf).update(mensaje).digest();
  /* Truncamiento dinámico: los 4 bits bajos del último byte dicen desde
     dónde leer los 4 bytes que forman el número. */
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binario = ((hmac[offset] & 0x7f) << 24)
    | (hmac[offset + 1] << 16)
    | (hmac[offset + 2] << 8)
    | hmac[offset + 3];
  return String(binario % 1000000).padStart(6, '0');
}

function comparaSegura(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Valida un código TOTP contra un secreto base32.
 * Devuelve el contador (paso de 30 s) que casó, o null si ninguno casa.
 *
 * `contadorMinimo` rechaza un código de un paso ya usado: sin eso, el
 * mismo código sirve durante toda su ventana de validez y alguien que lo
 * vea de reojo (o lo intercepte) puede reusarlo.
 */
function verificarTotp(secretoBase32, codigo, contadorMinimo) {
  const limpio = String(codigo || '').replace(/\D/g, '');
  if (limpio.length !== 6) return null;

  const secreto = base32Decode(secretoBase32);
  if (!secreto.length) return null;

  const ahora = Math.floor(Date.now() / 1000 / 30);
  for (let d = -MFA_DERIVA_PASOS; d <= MFA_DERIVA_PASOS; d++) {
    const contador = ahora + d;
    if (typeof contadorMinimo === 'number' && contador <= contadorMinimo) continue;
    if (comparaSegura(totpCodigo(secreto, contador), limpio)) return contador;
  }
  return null;
}

/* ─── Códigos de recuperación ─────────────────────────────────────
   Alfabeto sin 0/O/1/I/L para que nadie los transcriba mal al teléfono. */
const REC_ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function nuevoCodigoRecuperacion() {
  const bytes = crypto.randomBytes(10);
  let salida = '';
  for (let i = 0; i < 10; i++) {
    salida += REC_ALFABETO[bytes[i] % REC_ALFABETO.length];
    if (i === 4) salida += '-';
  }
  return salida;
}

function hashRecuperacion(codigo) {
  return crypto.createHash('sha256')
    .update(String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .digest('hex');
}

/* ─── Claims ──────────────────────────────────────────────────────
   SIEMPRE se leen los claims actuales y se escribe el conjunto completo:
   setCustomUserClaims REEMPLAZA todo. Escribir solo {mfa, mfaUntil}
   borraría clinicId/rol/superadmin y dejaría al usuario sin acceso a
   nada. Es el mismo cuidado que ahora tiene onUsuarioWrite del otro lado. */
async function fijarClaimsMfa(uid, activo) {
  const user = await admin.auth().getUser(uid);
  const claims = Object.assign({}, user.customClaims || {});

  if (activo) {
    claims.mfa = true;
    claims.mfaUntil = Date.now() + MFA_VENTANA_HORAS * 60 * 60 * 1000;
  } else {
    delete claims.mfa;
    delete claims.mfaUntil;
  }

  await admin.auth().setCustomUserClaims(uid, claims);
  /* El cliente escucha /_claimsRefresh/{uid} (ver r3ads-staff.js) y fuerza
     el refresh del ID token — sin esto seguiría usando el token viejo, sin
     el claim nuevo, hasta una hora. */
  await db.collection('_claimsRefresh').doc(uid).set({
    refreshedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return claims.mfaUntil || null;
}

/* Espeja el estado (nunca el secreto) en /usuarios/{uid} para que la
   interfaz y Admin-Usuarios.html sepan quién tiene 2FA activo. */
async function espejarEstado2FA(uid, activo) {
  await db.collection('usuarios').doc(uid).set({
    dosFactoresActivo: !!activo,
    dosFactoresActualizadoEn: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

function exigeAuth(context) {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Iniciá sesión primero.');
  }
  return context.auth.uid;
}

/* Bloqueo por fuerza bruta. Un código TOTP son 6 dígitos: sin esto,
   probar el millón de combinaciones es cuestión de tiempo. */
function revisarBloqueo(datos) {
  const lockedUntil = datos && datos.lockedUntil;
  if (lockedUntil && lockedUntil.toMillis() > Date.now()) {
    const minutos = Math.ceil((lockedUntil.toMillis() - Date.now()) / 60000);
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Demasiados códigos incorrectos. Probá de nuevo en ' + minutos + ' minuto(s).'
    );
  }
}

async function registrarFallo(ref, datos) {
  const intentos = ((datos && datos.intentos) || 0) + 1;
  if (intentos >= MFA_INTENTOS_MAX) {
    await ref.set({
      intentos: 0,
      lockedUntil: admin.firestore.Timestamp.fromMillis(Date.now() + MFA_LOCK_MINUTOS * 60 * 1000)
    }, { merge: true });
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Demasiados códigos incorrectos. Tu cuenta queda bloqueada ' + MFA_LOCK_MINUTOS + ' minutos.'
    );
  }
  await ref.set({ intentos }, { merge: true });
  throw new functions.https.HttpsError(
    'invalid-argument',
    'Código incorrecto. Te quedan ' + (MFA_INTENTOS_MAX - intentos) + ' intento(s).'
  );
}

/**
 * iniciar2FA: genera un secreto nuevo y lo deja PENDIENTE (sin activar).
 * Hasta que confirmar2FA valide un código, el 2FA no está activo — así un
 * enrolamiento a medias (el usuario cierra la pestaña al ver el QR) no lo
 * deja sin poder entrar.
 */
exports.iniciar2FA = functions.https.onCall(async (data, context) => {
  const uid = exigeAuth(context);
  const ref = seguridad2FARef(uid);
  const snap = await ref.get();

  if (snap.exists && snap.data().activo) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Ya tenés el segundo factor activo. Desactivalo antes de configurar uno nuevo.'
    );
  }

  const secretoBase32 = base32Encode(crypto.randomBytes(20)); /* 160 bits, lo que recomienda el RFC */
  await ref.set({
    secretoPendiente: secretoBase32,
    activo: false,
    intentos: 0,
    lockedUntil: null,
    iniciadoEn: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const email = (context.auth.token && context.auth.token.email) || uid;
  const etiqueta = encodeURIComponent('Ancla:' + email);
  const otpauthUri = 'otpauth://totp/' + etiqueta +
    '?secret=' + secretoBase32 +
    '&issuer=Ancla&algorithm=SHA1&digits=6&period=30';

  return { secretoBase32, otpauthUri };
});

/**
 * confirmar2FA: valida el primer código contra el secreto pendiente y, si
 * casa, activa el 2FA y entrega los códigos de recuperación (única vez que
 * se ven en claro — de ahí en adelante solo existen sus hashes).
 */
exports.confirmar2FA = functions.https.onCall(async (data, context) => {
  const uid = exigeAuth(context);
  const ref = seguridad2FARef(uid);
  const snap = await ref.get();
  const datos = snap.exists ? snap.data() : null;

  if (!datos || !datos.secretoPendiente) {
    throw new functions.https.HttpsError('failed-precondition', 'Empezá la configuración de nuevo.');
  }
  revisarBloqueo(datos);

  const contador = verificarTotp(datos.secretoPendiente, data && data.codigo, null);
  if (contador === null) return registrarFallo(ref, datos);

  const codigos = [];
  for (let i = 0; i < MFA_CODIGOS_RECUPERACION; i++) codigos.push(nuevoCodigoRecuperacion());

  await ref.set({
    secreto: datos.secretoPendiente,
    secretoPendiente: admin.firestore.FieldValue.delete(),
    activo: true,
    ultimoContador: contador,
    intentos: 0,
    lockedUntil: null,
    codigosRecuperacion: codigos.map(hashRecuperacion),
    activadoEn: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const mfaUntil = await fijarClaimsMfa(uid, true);
  await espejarEstado2FA(uid, true);

  return { ok: true, codigosRecuperacion: codigos, mfaUntil };
});

/**
 * verificar2FA: el paso que corre después de la contraseña en cada login.
 * Acepta un código TOTP o uno de recuperación (que se consume).
 */
exports.verificar2FA = functions.https.onCall(async (data, context) => {
  const uid = exigeAuth(context);
  const ref = seguridad2FARef(uid);
  const snap = await ref.get();
  const datos = snap.exists ? snap.data() : null;

  if (!datos || !datos.activo || !datos.secreto) {
    throw new functions.https.HttpsError('failed-precondition', 'No tenés segundo factor configurado.');
  }
  revisarBloqueo(datos);

  const contador = verificarTotp(datos.secreto, data && data.codigo, datos.ultimoContador);
  if (contador !== null) {
    await ref.set({ ultimoContador: contador, intentos: 0, lockedUntil: null }, { merge: true });
    const mfaUntil = await fijarClaimsMfa(uid, true);
    return { ok: true, mfaUntil, usoRecuperacion: false };
  }

  /* ¿Era un código de recuperación? Se consume: un código de un solo uso
     que sigue sirviendo no es de un solo uso. */
  const hash = hashRecuperacion(data && data.codigo);
  const restantes = (datos.codigosRecuperacion || []).filter((h) => h !== hash);
  if (restantes.length !== (datos.codigosRecuperacion || []).length) {
    await ref.set({
      codigosRecuperacion: restantes,
      ultimoContador: datos.ultimoContador || null,
      intentos: 0,
      lockedUntil: null
    }, { merge: true });
    const mfaUntil = await fijarClaimsMfa(uid, true);
    return { ok: true, mfaUntil, usoRecuperacion: true, codigosRestantes: restantes.length };
  }

  return registrarFallo(ref, datos);
});

/**
 * desactivar2FA: exige un código válido (TOTP o de recuperación) antes de
 * apagarlo. Si no lo exigiera, alguien con solo la contraseña —justo lo
 * que el segundo factor viene a cubrir— podría quitarlo y seguir de largo.
 */
exports.desactivar2FA = functions.https.onCall(async (data, context) => {
  const uid = exigeAuth(context);
  const ref = seguridad2FARef(uid);
  const snap = await ref.get();
  const datos = snap.exists ? snap.data() : null;

  if (!datos || !datos.activo) return { ok: true }; /* ya estaba apagado */
  revisarBloqueo(datos);

  const porTotp = verificarTotp(datos.secreto, data && data.codigo, datos.ultimoContador) !== null;
  const porRecuperacion = (datos.codigosRecuperacion || []).indexOf(hashRecuperacion(data && data.codigo)) !== -1;
  if (!porTotp && !porRecuperacion) return registrarFallo(ref, datos);

  await ref.delete();
  await fijarClaimsMfa(uid, false);
  await espejarEstado2FA(uid, false);
  return { ok: true };
});

/**
 * regenerarCodigos2FA: entrega un juego nuevo de códigos de recuperación y
 * anula los viejos. Exige un código TOTP válido (no uno de recuperación: si
 * un código de recuperación robado pudiera generar ocho nuevos, quien lo
 * tenga se queda con la cuenta para siempre).
 */
exports.regenerarCodigos2FA = functions.https.onCall(async (data, context) => {
  const uid = exigeAuth(context);
  const ref = seguridad2FARef(uid);
  const snap = await ref.get();
  const datos = snap.exists ? snap.data() : null;

  if (!datos || !datos.activo || !datos.secreto) {
    throw new functions.https.HttpsError('failed-precondition', 'No tenés segundo factor configurado.');
  }
  revisarBloqueo(datos);

  const contador = verificarTotp(datos.secreto, data && data.codigo, datos.ultimoContador);
  if (contador === null) return registrarFallo(ref, datos);

  const codigos = [];
  for (let i = 0; i < MFA_CODIGOS_RECUPERACION; i++) codigos.push(nuevoCodigoRecuperacion());

  await ref.set({
    codigosRecuperacion: codigos.map(hashRecuperacion),
    ultimoContador: contador,
    intentos: 0,
    lockedUntil: null
  }, { merge: true });

  return { ok: true, codigosRecuperacion: codigos };
});

/**
 * resetear2FAUsuario: escape hatch para un teléfono perdido sin códigos de
 * recuperación a mano. Lo puede hacer el admin de la MISMA clínica o un
 * superadmin de R3ads — nunca el propio usuario (si pudiera resetearse
 * solo con la contraseña, el segundo factor no sería un segundo factor).
 */
exports.resetear2FAUsuario = functions.https.onCall(async (data, context) => {
  const solicitanteUid = exigeAuth(context);
  const uid = String((data && data.uid) || '').trim();
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'Falta el usuario.');
  if (uid === solicitanteUid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'No podés resetear tu propio segundo factor. Pedíselo al admin de tu clínica.'
    );
  }

  const token = context.auth.token || {};
  const esSuperAdmin = token.superadmin === true;

  if (!esSuperAdmin) {
    /* Admin de la misma clínica: se compara contra el doc del objetivo, no
       contra lo que mande el cliente. */
    const objetivo = await db.collection('usuarios').doc(uid).get();
    if (!objetivo.exists) throw new functions.https.HttpsError('not-found', 'No existe ese usuario.');
    const mismaClinica = token.clinicId && objetivo.data().clinicId === token.clinicId;
    if (token.rol !== 'admin' || !mismaClinica) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Solo un admin de la misma clínica puede resetear el segundo factor de otro usuario.'
      );
    }
  }

  await seguridad2FARef(uid).delete().catch(() => {});
  await fijarClaimsMfa(uid, false);
  await espejarEstado2FA(uid, false);
  return { ok: true };
});

/* ════════════════════════════════════════════════════════════════════
 * asignarAdminClinica — pone a alguien como admin de una clínica, exista
 * o no su cuenta de Auth. Solo superadmin.
 *
 * POR QUÉ EXISTE
 * --------------
 * portal-admin.html creaba al admin con createUserWithEmailAndPassword
 * desde una instancia secundaria de Firebase. Eso solo funciona si el
 * correo NO tiene cuenta todavía; si ya la tiene, Auth devuelve
 * auth/email-already-in-use y el panel mostraba "Ese correo ya tiene una
 * cuenta registrada" sin ninguna salida.
 *
 * Y ese caso no es raro: es el NORMAL cuando la clínica se dio de alta
 * sola y eligió pagar por transferencia. crearClinicaSelfService ya creó
 * la cuenta del dueño Y su /usuarios/{uid} con rol admin — o sea que al
 * superadmin le rebotaba justo el correo de la persona que ya era la
 * administradora de esa clínica.
 *
 * El cliente no puede resolver esto solo: no hay forma de traducir un
 * correo a un uid desde el SDK web (a propósito, sería un oráculo de
 * enumeración de correos). Hace falta el Admin SDK, o sea esta función.
 *
 * Qué hace según el caso, y qué devuelve en `resultado`:
 *   'creado'      no existía la cuenta → la crea y crea su /usuarios
 *   'vinculado'   la cuenta existía sin /usuarios → lo crea para esta clínica
 *   'promovido'   ya era staff de ESTA clínica → lo sube a admin/activo
 *   'ya-era-admin' ya era admin activo de esta clínica → no toca nada
 *
 * Lo que NO hace, a propósito: mover a alguien de una clínica a otra. Eso
 * ya está prohibido en firestore.rules (el update de /usuarios exige que
 * clinicId no cambie) y acá se rechaza igual, para que la función no sea
 * una puerta trasera a la regla.
 * ════════════════════════════════════════════════════════════════════ */
exports.asignarAdminClinica = functions
  .runWith({ enforceAppCheck: true })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.superadmin !== true) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Solo un superadmin de R3ads puede asignar el admin de una clínica.'
      );
    }

    const clinicId = String((data && data.clinicId) || '').trim();
    const email = String((data && data.email) || '').trim().toLowerCase();
    const nombre = String((data && data.nombre) || '').trim().slice(0, 120);

    if (!clinicId) throw new functions.https.HttpsError('invalid-argument', 'Falta la clínica.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new functions.https.HttpsError('invalid-argument', 'El correo no es válido.');
    }
    if (!nombre) throw new functions.https.HttpsError('invalid-argument', 'Falta el nombre completo.');

    const clinicSnap = await db.collection('clinics').doc(clinicId).get();
    if (!clinicSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'No existe esa clínica.');
    }

    /* ── ¿Ya tiene cuenta de Auth? ── */
    let userRecord = null;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        console.error('[asignarAdminClinica] getUserByEmail falló:', err);
        throw new functions.https.HttpsError('internal', 'No se pudo consultar la cuenta. Intenta de nuevo.');
      }
    }

    let resultado;
    let cuentaNueva = false;

    if (!userRecord) {
      /* Contraseña aleatoria que nadie ve: el alta se completa con el
         correo de "establecer contraseña" que manda el panel después. */
      userRecord = await admin.auth().createUser({
        email: email,
        emailVerified: false,
        displayName: nombre,
        password: crypto.randomBytes(24).toString('base64url'),
      });
      cuentaNueva = true;
      resultado = 'creado';
    }

    const uid = userRecord.uid;
    const usuarioRef = db.collection('usuarios').doc(uid);
    const usuarioSnap = await usuarioRef.get();

    if (usuarioSnap.exists) {
      const actual = usuarioSnap.data();
      if (actual.clinicId && actual.clinicId !== clinicId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Ese correo ya pertenece a otra clínica (' + actual.clinicId + '). ' +
          'Una cuenta no puede administrar dos clínicas: usa un correo distinto.'
        );
      }
      if (actual.rol === 'admin' && actual.estado === 'activo') {
        resultado = 'ya-era-admin';
        /* No se escribe /usuarios, así que onUsuarioWrite no corre y nada
           avisaría al cliente. Pero si el superadmin llegó hasta acá es
           porque alguien NO está pudiendo entrar, y la causa típica es un
           ID token viejo: se cachea hasta una hora, y el minteado antes de
           que se fijaran los claims no los trae. Tocar /_claimsRefresh hace
           que la pestaña de esa persona —que ya escucha este doc, ver
           watchClaimsRefresh en r3ads-staff.js— refresque su token y se
           recargue sola. Así el botón hace algo útil en vez de responder
           "ya era admin" y dejarla igual de afuera. */
        await db.collection('_claimsRefresh').doc(uid).set({
          refreshedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await usuarioRef.update({
          rol: 'admin',
          estado: 'activo',
          actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
        resultado = 'promovido';
      }
    } else {
      await usuarioRef.set({
        nombre: nombre,
        email: email,
        rol: 'admin',
        estado: 'activo',
        clinicId: clinicId,
        uid: uid,
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (!resultado) resultado = 'vinculado';
    }

    /* onUsuarioWrite fija los custom claims (clinicId/rol) al escribir
       /usuarios/{uid} y avisa al cliente por /_claimsRefresh — no hace
       falta tocarlos acá. */

    return {
      resultado: resultado,
      uid: uid,
      email: email,
      /* Solo una cuenta recién creada necesita establecer contraseña. A
         quien ya tenía cuenta NO se le manda reset: no perdió su
         contraseña, y mandárselo parecería un intento de robo de cuenta. */
      enviarReset: cuentaNueva,
    };
  });
