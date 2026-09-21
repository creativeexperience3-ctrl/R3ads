# R3ads Portal Clínico

SaaS white-label por suscripción del sistema de expedientes/consultas/caja
que R3ads construyó originalmente para Clínica Médica General (CMG). Cada
clínica paga una mensualidad por su propia instancia aislada, en vez de
comprar el software una sola vez.

Plan completo (fases, arquitectura, riesgos):
`C:\Users\Ruben Wainwright\.claude\plans\misty-meandering-possum.md`

## Ubicación

Esta carpeta vive **dentro del repo de GitHub de R3ads**
(`github.com/creativeexperience3-ctrl/R3ads`, la misma cuenta/remote que usa
`R3ads/web`, el sitio de la agencia) como subcarpeta `portal-clinico/` —
no es un repo separado. Es un producto más de R3ads, así que comparte
repositorio con el sitio de la agencia.

**Importante sobre Firebase:** compartir repo de GitHub NO significa
compartir proyecto de Firebase. `R3ads/web` (la carpeta hermana de esta)
ya está desplegado en el proyecto Firebase `r3ads-59bd8` (ver su
`.firebaserc`/`firebase.json` en la raíz del repo) para el sitio/intake de
la agencia — ese proyecto no debe reutilizarse aquí, tiene sus propias
colecciones y reglas de Firestore para ese negocio, sin ningún concepto de
clínica. Este subdirectorio necesita su **propio proyecto Firebase nuevo**
(Fase 0 del plan) y su propio `.firebaserc`/`firebase.json` local a esta
carpeta, para desplegarse de forma independiente
(`cd portal-clinico && firebase deploy --project <su-proyecto>`) sin tocar
el hosting/Firestore del sitio de la agencia.

**Proyecto Firebase de este producto:** `r3ads-clinic-crm`, bajo la cuenta
`creativeexperience3@gmail.com` (creado 2026-09-21). `.firebaserc` en esta
carpeta ya apunta ahí.

**Dominio del producto:** subdominio por clínica sobre un dominio nuevo que
R3ads va a comprar específicamente para este producto (ej.
`clinica-x.eldominio.com`) — no cada clínica con su propio dominio propio.
El panel de administración interno de R3ads (Fase 4) vive aparte, dentro de
`r3ads.com`, y solo se conecta a `r3ads-clinic-crm` vía SDK — no necesita
compartir dominio con el producto.

## Cómo desplegar (una vez configurado)

```bash
cd portal-clinico
firebase login                        # una sola vez
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

`firebase.json`/`.firebaserc` en esta carpeta son independientes de los de
`R3ads/web` (la carpeta hermana) — cada uno despliega a su propio proyecto.

## Estado de la migración (2026-09-21)

Este código nace como copia genericizada del módulo clínico de
[`CMG-Website`](../../../CLINICA%20MEDICA%20GENERAL/CMG-Website) — **no** de
todo el sitio (los paneles de Ads/Finanzas/Contenido/Doctor 365 de CMG se
quedan fuera, ver el plan).

### ✅ Hecho
- **`firestore.rules`** — reescrito multi-tenant: sin listas de correos
  hardcodeadas, cada colección exige `clinicId` del token == `clinicId` del
  documento, más `clinicActiva()` (corta acceso si la suscripción se
  suspende). Ver comentarios en el archivo para las notas de migración
  (`esServicioEnfermeria`, create de Caja en `consultas`).
- **`storage.rules`** — reescrito con rutas por clínica
  (`/clinics/{clinicId}/expedientes/...` en vez de `/expedientes/...`).
- **`r3ads-staff.js`** — reemplaza a `cmg-staff.js`: sin bootstrap de
  correos, cada check ahora recibe `clinicId` como argumento.
- **`firebase-init.js`** — genérico (`window.r3adsAuth`/`window.r3adsDb` en
  vez de `cmgAuth`/`cmgDb`), con placeholder de config (**no** apunta al
  Firebase de CMG).
- **`clinic-config.example.js`** — patrón para que cada instancia desplegada
  sepa a qué clínica pertenece (ver Fase 5 del plan), con campos de branding
  para documentos impresos (`razonSocial`, `direccion`, `ciudad`, `telefono`,
  `whatsapp`, `correo`, `sitioWeb`).
- **Las 13 páginas HTML del módulo clínico** (`Auth.html`,
  `Admin-Usuarios.html`, `Admin-Precios.html`, `Resultado-EKG.html`,
  `Constancia-Medica.html`, `Ver-Prueba.html`, `Mis-Cotizaciones.html`,
  `Examenes-Laboratorio.html`, `Pruebas-Rapidas.html`, `Mi-Historial.html`,
  `Cotizador.html`, `Cotizacion-Sistema.html`, `Expediente-Doctor.html`)
  ya usan `r3adsAuth`/`r3adsDb`, `r3adsStaff.*(user, clinicId, cb)`, leen su
  branding desde `clinic-config.js`, y escriben/leen `clinicId` en cada
  documento. **Portado completo** — ver "Gaps conocidos" abajo para lo que
  queda pendiente de reconciliar, no de portar.
- **`Expediente-Doctor.html`** introduce `servicioKey` (mismo slug que
  `Admin-Precios.html`) al crear consultas de tipo servicio, calculado en
  vivo parseando `Cotizador.html` — así queda garantizado que coincide con
  las claves reales de `catalogoConfig`, sin mantener una tabla duplicada.
  El código de paciente usa `CLINIC.prefijoCodigoPaciente`, y los documentos
  impresos (PDF de consulta, Word del expediente) ya muestran los datos de
  la clínica activa en vez de los de CMG.
- **`Admin-Precios.html`** ya no gestiona descuentos de Doctor 365 (fuera de
  alcance) — en su lugar guarda `enfermeriaCompletable` por ítem del
  catálogo, que alimenta directamente `esServicioEnfermeria()` en
  `firestore.rules`.
- **Doctor 365 removido** de todas las páginas portadas (no solo
  rebautizado) — ver notas en `Cotizador.html`/`Cotizacion-Sistema.html`
  sobre el impacto en el cálculo de precios de tercera/cuarta edad.

- **Desplegado a producción (2026-09-21)**: `firestore.rules`, `storage.rules`,
  índices compuestos, y la Cloud Function `onUsuarioWrite` (activa, Node 22,
  `us-central1`) ya están corriendo en `r3ads-clinic-crm`. Config real del
  SDK web ya está en `firebase-init.js`.
- **`functions/onUsuarioWrite`** — Cloud Function que fija los custom claims
  (`clinicId`, `rol`) al escribir `/usuarios/{uid}`, y escribe en
  `/_claimsRefresh/{uid}` para avisarle al cliente que debe refrescar su ID
  token (si no, un usuario recién creado o con el rol recién cambiado no
  vería el efecto hasta que su token expire solo, hasta 1 hora). El
  refresco automático ya está en `r3ads-staff.js` (escucha ese doc y
  recarga la página). Nota: `estado !== 'activo'` deja el claim `rol` en
  `null` — el usuario conserva `clinicId` pero ninguna regla basada en rol
  lo deja pasar.
- **`firebase.json` / `.firebaserc` / `firestore.indexes.json`** — apuntan
  a `r3ads-clinic-crm`. Los índices compuestos conocidos
  (`usuarios`, `examenesLaboratorio`, `resultadosPruebas` — todos
  `clinicId` + `orderBy` de fecha) ya están declarados; otras queries
  compuestas (ej. la paginación de pacientes en `Expediente-Doctor.html`)
  se descubren en runtime — Firebase da un enlace en el error de consola
  para crear el índice que falte la primera vez que corra esa query.

### ⏳ Pendiente
- **Otorgar el primer `superadmin`** — no hay forma de hacerlo desde la app
  a propósito (ver nota de seguridad en `firestore.rules`); se hace una
  sola vez con el Admin SDK / `firebase-admin` desde una consola local,
  nunca vía un endpoint que el cliente pueda alcanzar.
- **Panel de administración R3ads** (alta manual de clínicas, Fase 4).
- **Suscripción/cobro** (Stripe) y gating por `clinics/{clinicId}.estado`
  (Fase 6).
- **Resolutor dinámico de subdominio** (Fase 5) — con el dominio del
  producto decidido como subdominio-por-clínica, `clinic-config.js` (hoy un
  archivo estático por despliegue) debe reemplazarse por algo que lea
  `window.location.hostname` y busque la clínica correspondiente en
  Firestore en vez de depender de un archivo distinto por clínica.

### ⚠️ Gaps conocidos (revisar antes de la primera clínica de pago)
- **Qué servicios registra Caja directo sin preclínica de enfermería**:
  documentado en `firestore.rules` (sección `consultas` → create) y con
  `// TODO` en `Expediente-Doctor.html` — hoy sigue como lista hardcodeada
  en el cliente (`SERVICIOS_SIN_PRECLINICA`) porque no hay campo de catálogo
  equivalente a `enfermeriaCompletable` para esta distinción todavía.
- **5 nombres de servicio no coinciden** entre el catálogo interno de
  `Expediente-Doctor.html` y `Cotizador.html` (`Aplicación de Suero`,
  las dos variantes de `Sueroterapia Glutatión + Vit C`, `Cirugía menor`,
  `Retiro de puntos`, `Curación` — variantes/nombres distintos). El sistema
  falla en modo seguro (exige médico) para esos, pero enfermería nunca podrá
  completarlos hasta reconciliar los nombres entre ambos archivos.
- Dos consultas de migración de datos legacy en `Expediente-Doctor.html`
  ("vincular pruebas/exámenes viejos sin código de paciente") ahora llevan
  `.where('clinicId', ...)` — antes no tenían ningún filtro; probar ese
  flujo específico una vez exista una clínica de prueba real.

`HISTORIAL-MEDICO-README.md` se mantiene como referencia del modelo de
datos original de CMG (útil para portar cada página), pero ya no describe
el esquema real de este repo una vez agregado `clinicId` — ver
`firestore.rules` como fuente de verdad del esquema multi-tenant.
