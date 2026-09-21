/* ============================================================
   clinic-config.js (EJEMPLO) — Configuración de instancia por clínica.

   Cada clínica dada de alta (Fase 4 del plan: alta manual por R3ads) recibe
   su PROPIO archivo clinic-config.js, cargado antes de firebase-init.js y
   r3ads-staff.js en cada página. Este archivo es lo que le dice a una
   instancia desplegada "a qué clínica perteneces" — la pieza mínima de
   white-label antes de construir resolución dinámica por subdominio
   (Fase 8, autoservicio).

   Copiar este archivo a clinic-config.js (NO commitear ese archivo real
   por clínica en este repo compartido — cada instancia desplegada tiene
   el suyo) y llenar con los datos de esa clínica, tal como quedó registrada
   en /clinics/{clinicId} por el panel de administración de R3ads.
   ============================================================ */
window.R3ADS_CLINIC_ID = 'PENDIENTE-id-de-la-clinica';

// Solo para mostrar algo razonable antes de que cargue el doc de Firestore
// (nombre/logo/colores reales viven en /clinics/{clinicId}, ver Fase 5).
// razonSocial/direccion/telefono/correo se usan en el encabezado y pie de
// los documentos imprimibles (constancias, informes de EKG, etc.) — sin
// esto, esos PDF saldrían con los datos de CMG en vez de los de la clínica.
window.R3ADS_CLINIC_FALLBACK = {
  nombre: 'Nombre de la Clínica',
  razonSocial: 'Nombre de la Clínica, S. de R.L.',
  prefijoCodigoPaciente: 'CLI',
  direccion: 'Dirección de la clínica',
  ciudad: 'Ciudad',
  telefono: '+000 0000-0000',
  whatsapp: '5040000000', // solo dígitos, con código de país, para wa.me/
  correo: 'contacto@tuclinica.com',
  sitioWeb: 'tuclinica.com'
};
