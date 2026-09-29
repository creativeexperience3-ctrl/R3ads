/* ============================================================
   aplicar-storage-cors.js — configura CORS en el bucket de Storage
   de r3ads-clinic-crm a partir de storage-cors.json.

   POR QUÉ EXISTE
   --------------
   La exportación del expediente completo (`exportarExpedienteZip` en
   Expediente-Doctor.html) mete los adjuntos al ZIP haciendo `fetch(url)`
   contra la URL de descarga de Firebase Storage y leyendo el `.blob()`.
   Eso es una lectura cross-origin: el navegador la bloquea salvo que el
   BUCKET declare el origen en su configuración de CORS.

   Sin esto el ZIP igual se genera, pero TODOS los adjuntos (los PDF de
   consulta, el Word del expediente, las imágenes) caen al archivo
   ARCHIVOS-NO-INCLUIDOS.txt y el paciente se lleva solo los datos, no los
   documentos. O sea: la promesa de portabilidad de Privacidad.html §10/§11
   depende de que esta configuración esté puesta.

   Los orígenes de storage-cors.json son los dos sitios de Hosting del
   proyecto (portal clínico y portal paciente), el dominio propio previsto
   (ancla.r3ads.com), el sitio de la agencia — donde vive portal-admin.html —
   y localhost para `firebase serve`. Solo GET/HEAD: nadie necesita escribir
   al bucket desde otro origen.

   CÓMO SE CORRE
   -------------
     cd portal-clinico/functions
     node aplicar-storage-cors.js

   Necesita serviceAccountKey.json en esta misma carpeta (gitignored, igual
   que para otorgar-superadmin.js). Con gcloud/gsutil instalado el
   equivalente de una línea sería:

     gsutil cors set storage-cors.json gs://r3ads-clinic-crm.firebasestorage.app

   Es idempotente: reemplaza la configuración entera por la del JSON, así
   que correrlo dos veces deja el mismo resultado. Aplicado por primera vez
   el 2026-09-29.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const BUCKET = 'r3ads-clinic-crm.firebasestorage.app';
const KEY_FILE = path.join(__dirname, 'serviceAccountKey.json');
const CORS_FILE = path.join(__dirname, 'storage-cors.json');

async function main() {
  if (!fs.existsSync(KEY_FILE)) {
    throw new Error('Falta serviceAccountKey.json en ' + __dirname);
  }
  const cors = JSON.parse(fs.readFileSync(CORS_FILE, 'utf8'));

  const auth = new GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const token = (await (await auth.getClient()).getAccessToken()).token;

  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}?fields=name,cors`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cors }),
    }
  );

  const body = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ' — ' + body);

  console.log('CORS aplicado en ' + BUCKET + ':');
  console.log(body);
}

main().catch((err) => {
  console.error('No se pudo aplicar CORS:', err.message);
  process.exit(1);
});
