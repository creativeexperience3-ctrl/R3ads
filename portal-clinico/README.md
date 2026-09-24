# Ancla — Portal Clínico (producto de R3ads)

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

**Marca del producto (2026-09-21):** el producto se llama **Ancla**. Identidad
casi monocromática (Jet Black `#242F40` + Graphite `#363636` + blanco, con
Golden Bronze `#CCA43B` solo como detalle mínimo) — ver
`assets/portal-tokens.css`. Logo pendiente: se diseñará con un diseñador.

**Dominio (decidido 2026-09-22): UN SOLO dominio, sin subdominio por
clínica.** Todas las clínicas entran por `ancla.r3ads.com`; el `clinicId`
sale del usuario logueado, no del hostname.

Por qué se descartó el subdominio-por-clínica (`clinica-x.ancla.r3ads.com`),
que era el plan original: Firebase Hosting **no soporta dominios wildcard** y
su documentación dice *"Each custom domain is limited to having 20 subdomains
per apex domain, due to SSL certificate minting limits"*. O sea que el
esquema topaba en ~20 clínicas sobre `r3ads.com`, y cada alta exigía agregar
DNS + dominio a mano en la consola.

Lo que habilita esta decisión: desde que se removió el autoservicio de
paciente, el portal es **solo para staff**, y el staff se loguea. Su
`clinicId` ya vive en `/usuarios/{uid}` y en sus custom claims (los fija la
Cloud Function `onUsuarioWrite`, y `r3ads-staff.js` ya los lee). El
subdominio solo aportaba branding antes del login — que ahora se muestra
después de autenticar.

Consecuencias:
- **La Fase 5 (resolutor dinámico de subdominio) queda eliminada del plan.**
- Dar de alta una clínica = crear su doc en `/clinics/{clinicId}` y sus
  usuarios. Sin DNS, sin dominios, sin despliegue nuevo.
- Sin techo de 20 clínicas.

**`r3ads.com` ya está en vivo (2026-09-22)** — DNS configurado en Hostinger
(4 A records de GitHub Pages en el apex + `www` como CNAME al apex) y el
archivo `CNAME` está en `R3ads/web/`. Apex y `www` responden por HTTPS con
certificado válido. Falta configurar `ancla.r3ads.com` en Firebase Hosting
del proyecto `r3ads-clinic-crm`.

El panel de administración interno de R3ads (Fase 4) vive aparte, dentro de
`r3ads.com`, y solo se conecta a `r3ads-clinic-crm` vía SDK — no necesita
compartir dominio con el producto.

## Módulos contratados (2026-09-22)

Cada clínica paga por lo que usa. Qué tiene contratado vive en
`/clinics/{clinicId}.modulos`, un mapa de banderas que **solo superadmin
puede escribir** (es decisión de facturación, no de la clínica; las reglas
de `/clinics` ya son `allow write: if isSuperAdmin()`):

```
modulos: { laboratorio: true, pruebasRapidas: false,
           constancias: true, ekg: false }
```

**Semántica** (igual en cliente y en reglas, a propósito):
- Mapa ausente → **todo habilitado**. Compatibilidad con las clínicas dadas
  de alta antes de que esto existiera.
- Mapa presente → solo lo que está en `true`. Una clave ausente cuenta como
  apagada. El panel de alta (Fase 4) debe escribir siempre el mapa completo.

**Los 4 módulos opcionales:** `laboratorio`, `pruebasRapidas`, `constancias`,
`ekg`.

**Lo que NO es opcional:** expedientes, consultas/pendientes, búsqueda,
edición, historial, unificación y **caja**. Caja parece un módulo pero es el
cierre del circuito de la consulta (`pendiente_caja` → `completa`);
apagarla no oculta una pestaña, deja consultas sin poder cerrarse.

**Cómo está implementado, en tres capas:**
1. `clinic-modules.js` — saca del DOM los elementos con `[data-modulo="x"]`
   cuyo módulo esté apagado (se eliminan, no se ocultan con CSS, para que no
   queden botones invisibles alcanzables por teclado).
2. `r3adsModulos.exigir()` en el auth guard de cada página-módulo
   (`Examenes-Laboratorio`, `Pruebas-Rapidas`, `Ver-Prueba`,
   `Constancia-Medica`, `Resultado-EKG`). **Este es el candado que importa
   del lado del cliente**: muchos links a esas páginas se generan
   dinámicamente dentro de JS, imposibles de etiquetar uno por uno, pero
   todos terminan en la misma pantalla de "módulo no contratado".
3. `moduloActivo()` en `firestore.rules` — el candado real. Esconder botones
   no impide que alguien escriba directo contra Firestore.

**Alcance deliberado en las reglas: se exige el módulo para ESCRIBIR, no para
leer.** Si una clínica da de baja un módulo deja de registrar cosas nuevas,
pero sigue viendo lo que ya tenía: son datos clínicos de sus pacientes, no se
le pueden ocultar por una decisión comercial.

La pestaña "Pruebas Rápidas / Laboratorio" del portal cubre dos módulos a la
vez: solo desaparece si ambos están apagados (ver `aplicarModulos()` en
`Expediente-Doctor.html`).

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
- **Las 9 páginas HTML del módulo clínico** (`Auth.html`,
  `Admin-Usuarios.html`, `Admin-Precios.html`, `Resultado-EKG.html`,
  `Constancia-Medica.html`, `Ver-Prueba.html`,
  `Examenes-Laboratorio.html`, `Pruebas-Rapidas.html`,
  `Expediente-Doctor.html`)
  ya usan `r3adsAuth`/`r3adsDb`, `r3adsStaff.*(user, clinicId, cb)`, leen su
  branding desde `clinic-config.js`, y escriben/leen `clinicId` en cada
  documento. **Portado completo** — ver "Gaps conocidos" abajo para lo que
  queda pendiente de reconciliar, no de portar.
- **Autoservicio de paciente removido (2026-09-21)**: `Cotizador.html`,
  `Cotizacion-Sistema.html`, `Mis-Cotizaciones.html` y `Mi-Historial.html`
  se borraron por completo — el producto todavía no tiene clínicas de pago
  y el alcance del SaaS quedó definido como el portal de **staff**
  (Caja/Pacientes/Buscar/Pendientes dentro de `Expediente-Doctor.html`),
  no un portal de autoservicio para el paciente final. `Auth.html` ahora
  redirige por defecto a `Expediente-Doctor.html` en vez de
  `Mis-Cotizaciones.html`.
- **`catalogo-servicios.js`** — nuevo: catálogo base de servicios/precios,
  extraído programáticamente de `Cotizador.html` antes de borrarlo (mismos
  183 ítems en 8 categorías). Reemplaza el `fetch('Cotizador.html')` +
  `DOMParser` que usaban `Admin-Precios.html` y `Expediente-Doctor.html`
  para calcular `servicioKey` — ahora ambas leen directamente
  `window.R3ADS_CATALOGO` (cargado con `<script src="catalogo-servicios.js">`).
  Los precios/overrides por clínica siguen viviendo solo en Firestore
  (`catalogoConfig`), nunca en este archivo.
- **`Expediente-Doctor.html`** introduce `servicioKey` (mismo slug que
  `Admin-Precios.html`) al crear consultas de tipo servicio, calculado a
  partir de `catalogo-servicios.js` — así queda garantizado que coincide con
  las claves reales de `catalogoConfig`, sin mantener una tabla duplicada.
  El código de paciente usa `CLINIC.prefijoCodigoPaciente`, y los documentos
  impresos (PDF de consulta, Word del expediente) ya muestran los datos de
  la clínica activa en vez de los de CMG.
- **`Admin-Precios.html`** ya no gestiona descuentos de Doctor 365 (fuera de
  alcance) — en su lugar guarda `enfermeriaCompletable` por ítem del
  catálogo, que alimenta directamente `esServicioEnfermeria()` en
  `firestore.rules`.
- **Doctor 365 removido** de todas las páginas portadas (no solo
  rebautizado) — impacta el cálculo de precios de tercera/cuarta edad, ver
  `catalogo-servicios.js` para el catálogo actual sin ese descuento.

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

- **Panel de administración R3ads (Fase 4, 2026-09-22)** — `web/portal-admin.html`
  (fuera de esta carpeta, a propósito: vive dentro de `r3ads.com`/GitHub Pages,
  como dice la sección "Dominio" arriba, y se conecta a `r3ads-clinic-crm`
  solo vía SDK, con su propia config de Firebase embebida en el archivo).
  Gate de acceso por custom claim `superadmin` (mismo mecanismo que
  `checkSuperAdmin` en `r3ads-staff.js`, pero implementado aparte porque este
  panel no carga ese archivo). Permite, sin tocar la consola de Firebase:
  crear `clinics/{clinicId}` (con validación de ID único y formato), editar
  cualquier campo de una clínica ya creada (el ID queda bloqueado), activar/
  suspender, y crear el primer usuario `admin` de una clínica nueva (mismo
  patrón de instancia secundaria de Firebase que `Admin-Usuarios.html`, para
  no cerrar la sesión del superadmin al crear el `Auth` del nuevo admin).
  El formulario de alta/edición siempre escribe el mapa `modulos` completo
  (las 4 claves, nunca parcial ni ausente) — ver "Módulos contratados" arriba.

### ⏳ Pendiente
- **Otorgar el primer `superadmin`** — no hay forma de hacerlo desde la app
  a propósito (ver nota de seguridad en `firestore.rules`); se hace una
  sola vez con el Admin SDK / `firebase-admin` desde una consola local,
  nunca vía un endpoint que el cliente pueda alcanzar. Sin esto, el panel
  de administración R3ads (arriba) no deja entrar a nadie.
- **Suscripción/cobro** (PayPal Subscriptions, decidido 2026-09-24 — no
  Stripe, que no opera con empresas domiciliadas en Honduras) y gating por
  `clinics/{clinicId}.estado` (Fase 6). Requiere además legalizar la empresa
  ante el SAR (RTN de empresa + CAI) para poder facturar; mientras tanto se
  opera con RTN personal y cuenta PayPal Business a título personal.

### ✅ Hecho — `clinicId` desde la sesión, no desde un archivo estático
(2026-09-24; reemplaza a la vieja Fase 5, ver "Dominio" arriba). Las 11
páginas ya resuelven `CLINIC_ID` con `r3adsStaff.resolveClinicId(user, cb)`
dentro del AUTH GUARD (custom claim `clinicId` del token), no desde
`window.R3ADS_CLINIC_ID` en tiempo de build — confirmado por grep, sin
páginas pendientes. `window.R3ADS_CLINIC_FALLBACK` (de `clinic-config.js`)
se sigue usando solo para el branding de arranque antes de que cargue el
doc real de `/clinics/{clinicId}`, y para los documentos impresos.

**Con esto ya no hay bloqueo técnico para dar de alta la clínica #2** — el
paso que sigue es el piloto de la Fase 7 (alta real de 1-2 clínicas vía
`portal-admin.html` y validar que no hay fuga de datos entre tenants).

### ⚠️ Gaps conocidos (revisar antes de la primera clínica de pago)
- **Qué servicios registra Caja directo sin preclínica de enfermería**:
  documentado en `firestore.rules` (sección `consultas` → create) y con
  `// TODO` en `Expediente-Doctor.html` — hoy sigue como lista hardcodeada
  en el cliente (`SERVICIOS_SIN_PRECLINICA`) porque no hay campo de catálogo
  equivalente a `enfermeriaCompletable` para esta distinción todavía.
- **5 nombres de servicio no coinciden** entre el catálogo interno de
  `Expediente-Doctor.html` y `catalogo-servicios.js` (`Aplicación de Suero`,
  las dos variantes de `Sueroterapia Glutatión + Vit C`, `Cirugía menor`,
  `Retiro de puntos`, `Curación` — variantes/nombres distintos). El sistema
  falla en modo seguro (exige médico) para esos, pero enfermería nunca podrá
  completarlos hasta reconciliar los nombres entre ambos archivos.
- Dos consultas de migración de datos legacy en `Expediente-Doctor.html`
  ("vincular pruebas/exámenes viejos sin código de paciente") ahora llevan
  `.where('clinicId', ...)` — antes no tenían ningún filtro; probar ese
  flujo específico una vez exista una clínica de prueba real.
- **⚠️ `firestore.rules` editado (2026-09-21) pero NO redesplegado** — se
  quitaron la colección `/quotations/{id}`, el doc `/users/{uid}` (perfil de
  paciente, sin código que lo creara ni lo leyera), y las ramas
  `ownerUid`/`compartidoCon`/`solicitudesAcceso` en `expedientes`,
  `consultas`, `resultadosPruebas`, `examenesLaboratorio`, `constancias` y
  `electrocardiogramas` (autoservicio de paciente, muerto junto con
  `Mi-Historial.html`). El archivo local ya no coincide con lo desplegado en
  `r3ads-clinic-crm` hasta correr `firebase deploy --only firestore:rules`.
  `catalogoConfig` se dejó con lectura pública (`allow read: if true`)
  aunque ya no hay Cotizador anónimo que la necesite — bajo riesgo (son
  precios, no PII), no se tocó sin pedirlo explícitamente.

`HISTORIAL-MEDICO-README.md` se mantiene como referencia del modelo de
datos original de CMG (útil para portar cada página), pero ya no describe
el esquema real de este repo una vez agregado `clinicId` — ver
`firestore.rules` como fuente de verdad del esquema multi-tenant.
