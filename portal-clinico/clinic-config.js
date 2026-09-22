/* ============================================================
   clinic-config.js — Configuración de instancia para la CLÍNICA DEMO
   (bootstrap/pruebas del producto, ver README.md "Pendiente").

   Copiado de clinic-config.example.js. clinicId = 'demo' — separado de
   cualquier clínica real de pago; NO reutiliza el Firebase de CMG
   (r3ads-59bd8), vive en r3ads-clinic-crm igual que el resto del producto.
   ============================================================ */
window.R3ADS_CLINIC_ID = 'demo';

// Solo para mostrar algo razonable antes de que cargue el doc de Firestore
// (nombre/logo/colores reales viven en /clinics/{clinicId}).
window.R3ADS_CLINIC_FALLBACK = {
  nombre: 'Clínica Demo',
  razonSocial: 'Clínica Demo, S. de R.L.',
  prefijoCodigoPaciente: 'DEMO',
  direccion: 'Dirección de prueba',
  ciudad: 'Tegucigalpa',
  telefono: '+504 0000-0000',
  whatsapp: '50400000000',
  correo: 'demo@r3ads.com',
  sitioWeb: 'r3ads.com'
};
