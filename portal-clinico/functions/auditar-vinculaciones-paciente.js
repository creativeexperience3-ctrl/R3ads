/* ============================================================
   R3ads Portal Clínico — Auditar vinculaciones de paciente
   (uso local, una vez, después del cambio de reglas del 2026-10-02)

   Hasta el 2026-10-02, cualquier cuenta logueada que conociera el código
   de 6 caracteres de un expediente podía quedarse como su dueño
   (`ownerUid`) con solo pedirlo — las reglas solo exigían que el
   expediente no tuviera dueño todavía. Con eso también se destrababa la
   lectura de sus consultas, pruebas y laboratorios vía accesoPaciente(),
   y cruzando clínicas, porque este Firestore es multi-tenant.

   Ahora reclamar un expediente exige que el correo verificado de la
   cuenta coincida con el que la clínica anotó en
   `datosGenerales.email`. Este script revisa las vinculaciones que se
   hicieron con la regla vieja y marca las que esa regla nueva NO
   habría permitido.

   El correo que se compara es el de Firebase Auth, no el campo
   `ownerEmail` del expediente: ese lo escribió el propio cliente al
   reclamar, así que no sirve como prueba de nada.

   Uso:
     node auditar-vinculaciones-paciente.js [--aplicar] [ruta-a-service-account.json]

   Sin --aplicar solo informa (no escribe nada). Con --aplicar, a las
   vinculaciones sospechosas les borra ownerUid/ownerVinculado/ownerEmail
   para que el expediente vuelva a quedar sin dueño y el paciente legítimo
   lo pueda reclamar con la regla nueva. `compartidoCon` también se limpia:
   los accesos compartidos los aprobó el dueño sospechoso, no el paciente.

   Lo que NO hace: tocar /users/{uid}. El portal de paciente ya limpia
   solo las referencias que quedan colgando (ver desvincularCodigoInexistente
   y el permission-denied de cargarExpediente en Mi-Historial.html).
   ============================================================ */
const path = require('path');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const aplicar = args.indexOf('--aplicar') !== -1;
const keyPath = args.filter((a) => a !== '--aplicar')[0] || path.join(__dirname, 'serviceAccountKey.json');

let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch (err) {
  console.error('No se pudo leer la clave de service account en: ' + keyPath);
  console.error('Descargala desde Firebase Console → r3ads-clinic-crm → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const norm = (v) => String(v || '').trim().toLowerCase();

/* Cachea por uid: varios expedientes pueden apuntar al mismo dueño
   (el papá que vinculó el suyo y el de un hijo, por ejemplo). */
const cacheUsuarios = new Map();
async function authUser(uid) {
  if (cacheUsuarios.has(uid)) return cacheUsuarios.get(uid);
  const user = await admin.auth().getUser(uid).catch(() => null);
  cacheUsuarios.set(uid, user);
  return user;
}

async function main() {
  const snap = await db.collection('expedientes').where('ownerUid', '!=', null).get();
  console.log(`Expedientes con dueño vinculado: ${snap.size}\n`);

  const sospechosos = [];
  const ok = [];

  for (const doc of snap.docs) {
    const exp = doc.data();
    const emailClinica = norm((exp.datosGenerales || {}).email);
    const user = await authUser(exp.ownerUid);
    const emailCuenta = norm(user && user.email);

    const fila = {
      codigo: doc.id,
      clinicId: exp.clinicId || '(sin clinicId)',
      paciente: (exp.datosGenerales || {}).nombreCompleto || '(sin nombre)',
      emailClinica: emailClinica || '(vacío)',
      emailCuenta: emailCuenta || '(cuenta borrada)',
      verificado: !!(user && user.emailVerified),
      compartidoCon: (exp.compartidoCon || []).length
    };

    /* Las tres condiciones de la regla nueva: cuenta existente, correo
       verificado, y coincidencia con el correo que anotó la clínica. */
    if (user && user.emailVerified && emailClinica && emailClinica === emailCuenta) ok.push(fila);
    else sospechosos.push(fila);
  }

  console.log(`✅ Coinciden con la regla nueva: ${ok.length}`);
  ok.forEach((f) => console.log(`   ${f.codigo}  ${f.emailCuenta}  ${f.paciente}`));

  console.log(`\n⚠️  No habrían pasado la regla nueva: ${sospechosos.length}`);
  sospechosos.forEach((f) => {
    console.log(`   ${f.codigo}  [${f.clinicId}]  ${f.paciente}`);
    console.log(`      correo en el expediente: ${f.emailClinica}`);
    console.log(`      correo de la cuenta dueña: ${f.emailCuenta}${f.verificado ? '' : ' (SIN VERIFICAR)'}`);
    if (f.compartidoCon) console.log(`      además comparte acceso con ${f.compartidoCon} cuenta(s)`);
  });

  if (!sospechosos.length) {
    console.log('\nNada que corregir.');
    return;
  }

  if (!aplicar) {
    console.log('\nEsto fue solo un informe — no se escribió nada.');
    console.log('Para desvincular los de arriba: node auditar-vinculaciones-paciente.js --aplicar');
    return;
  }

  const lote = db.batch();
  sospechosos.forEach((f) => {
    lote.update(db.collection('expedientes').doc(f.codigo), {
      ownerUid: null,
      ownerVinculado: false,
      ownerEmail: null,
      compartidoCon: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await lote.commit();

  console.log(`\n✅ Desvinculados ${sospechosos.length} expediente(s).`);
  console.log('Cada paciente legítimo puede volver a reclamarlo desde el portal, una vez que');
  console.log('su clínica tenga su correo en datosGenerales.email y él haya verificado el suyo.');
}

main().catch((err) => {
  console.error('Error al auditar vinculaciones:', err.message || err);
  process.exit(1);
});
