/* ============================================================
   R3ads Portal Clínico — Otorgar superadmin (uso local, una vez)

   A propósito NO hay ningún camino en la app ni en las Cloud Functions
   para otorgar el custom claim `superadmin` — ver la nota de seguridad
   en firestore.rules. Se hace desde acá, a mano, con el Admin SDK.

   Uso:
     node otorgar-superadmin.js correo@ejemplo.com [ruta-a-service-account.json]

   Si no das la ruta, busca ./serviceAccountKey.json (mismo folder que
   este script). Ese archivo NUNCA se commitea — el .gitignore de la
   raíz del repo ya ignora *firebase-adminsdk*.json y
   serviceAccountKey*.json.

   Cómo conseguir el archivo:
     Firebase Console → proyecto r3ads-clinic-crm → ⚙️ Configuración
     del proyecto → Cuentas de servicio → Generar nueva clave privada.

   El usuario debe existir ya en Firebase Auth de r3ads-clinic-crm
   (haber intentado iniciar sesión al menos una vez en portal-admin.html
   sirve, aunque le haya dado "Sin acceso" — eso es justo lo que este
   script arregla).
   ============================================================ */
const path = require('path');
const admin = require('firebase-admin');

const email = process.argv[2];
const keyPath = process.argv[3] || path.join(__dirname, 'serviceAccountKey.json');

if (!email) {
  console.error('Uso: node otorgar-superadmin.js correo@ejemplo.com [ruta-a-service-account.json]');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch (err) {
  console.error('No se pudo leer la clave de service account en: ' + keyPath);
  console.error('Descargala desde Firebase Console → r3ads-clinic-crm → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function main() {
  const user = await admin.auth().getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(`No existe ningún usuario con el correo ${email} en Firebase Auth de r3ads-clinic-crm.`);
    console.error('Iniciá sesión una vez en portal-admin.html con ese correo (aunque te dé "Sin acceso") y volvé a correr este script.');
    process.exit(1);
  }

  const claimsActuales = user.customClaims || {};
  await admin.auth().setCustomUserClaims(user.uid, Object.assign({}, claimsActuales, { superadmin: true }));

  console.log(`✅ ${email} (uid ${user.uid}) ahora tiene el custom claim superadmin.`);
  console.log('Recargá portal-admin.html con sesión iniciada — fuerza un refresh del token al cargar, no hace falta cerrar sesión.');
}

main().catch((err) => {
  console.error('Error al otorgar superadmin:', err.message || err);
  process.exit(1);
});
