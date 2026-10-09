# Ancla — Portal Clínico (producto de R3ads)

SaaS white-label por suscripción del sistema de expedientes/consultas/caja
que R3ads construyó originalmente para Clínica Médica General (CMG). Cada
clínica paga una mensualidad por su propia instancia aislada, en vez de
comprar el software una sola vez.

Plan completo (fases, arquitectura, riesgos):
`C:\Users\Ruben Wainwright\.claude\plans\misty-meandering-possum.md`

**¿Qué falta?** → [lista consolidada al final de este
archivo](#qué-falta--lista-consolidada-al-2026-10-08). Las secciones de
"Estado de la migración" están ordenadas por fecha de cada avance, así que
sirven para entender cómo se llegó acá, no para saber qué queda.

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
certificado válido.

El reparto de dominios entre los sites de Hosting se administra en la
consola y se decide en producción; no es un pendiente de este repo.

El panel de administración interno de R3ads (Fase 4) vive aparte, dentro de
`r3ads.com`, y solo se conecta a `r3ads-clinic-crm` vía SDK — no necesita
compartir dominio con el producto.

## Módulos contratados (2026-09-22)

Cada clínica paga por lo que usa. Qué tiene contratado vive en
`/clinics/{clinicId}.modulos`, un mapa de banderas que **solo superadmin
puede escribir** (es decisión de facturación, no de la clínica; las reglas
de `/clinics` ya son `allow write: if isSuperAdmin()`):

```
modulos: { laboratorio: true, pruebasRapidas: false, constancias: true,
           ekg: false, historialCalendario: false }
```

**Semántica** (igual en cliente y en reglas, a propósito):
- Mapa ausente → **todo habilitado**. Compatibilidad con las clínicas dadas
  de alta antes de que esto existiera.
- Mapa presente → solo lo que está en `true`. Una clave ausente cuenta como
  apagada. El panel de alta (Fase 4) debe escribir siempre el mapa completo.

**Los 5 módulos opcionales:** `laboratorio`, `pruebasRapidas`, `constancias`,
`ekg`, `historialCalendario` (la vista de calendario dentro de Historial).

**Planes (en `portal-admin.html`, `MODULOS_PLANES`):** `basico` deja solo
`constancias` encendido; `completo` enciende los cinco. Son atajos del
formulario de alta para no marcar casilla por casilla — lo que se guarda en
`/clinics/{id}.modulos` sigue siendo el mapa completo de cinco claves, no
el nombre del plan. El panel también registra cómo pagó la clínica y hasta
cuándo, y muestra los días que faltan para el vencimiento.

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

**⚠️ Nunca despliegues desde la raíz del repo.** `R3ads/web/.firebaserc`
apunta a `r3ads-59bd8` (el sitio de la agencia) y la raíz tiene su propio
`firestore.rules`: un `firebase deploy --only firestore:rules` corrido ahí
le mete a la agencia las reglas equivocadas. Por eso conviene pasar
`--project r3ads-clinic-crm` siempre, aunque el `.firebaserc` de esta
carpeta ya lo tenga — es el seguro contra correrlo en el directorio
equivocado. Antes del primer deploy de una sesión:

```bash
pwd && cat .firebaserc    # debe decir r3ads-clinic-crm, NO r3ads-59bd8
```

El orden que funciona, con los dos portales: `firestore,functions` desde
esta carpeta, luego `--only hosting` desde acá y desde `portal-paciente/`.
Nota para Windows: el CLI y npm se instalan como shims de npm, así que
PowerShell puede bloquearlos por política de ejecución
(`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, una vez), y
`firebase deploy --dry-run` compila todo sin aplicar nada.

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
- **Páginas agregadas después del port** (no vienen de CMG, o vienen con
  cambios propios de Ancla): `Inicio.html` (hub), `Referencia-Medica.html`,
  `Medicamentos.html`, `Personal.html`, `Proveedores.html`,
  `Bitacora.html`, `Mi-Suscripcion.html`, `Precios.html`, `anuncio.html`
  (landing), `Terminos.html`, `Privacidad.html`, `Seguridad.html`. El
  conteo de "9 páginas portadas" describe el port original, no el tamaño
  actual del portal.
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
  (las 5 claves, nunca parcial ni ausente) — ver "Módulos contratados" arriba.

### ✅ Hecho — suscripción y cobro (Fase 6, 2026-09-26/29)

PayPal Subscriptions en **Live** (decidido 2026-09-24 — no Stripe, que no
opera con empresas domiciliadas en Honduras): `crearSuscripcionPayPal`,
`revisarSuscripcionPayPal`, `cancelarSuscripcionPayPal` y `paypalWebhook` en
`functions/index.js`, los planes creados con
`functions/crear-planes-paypal-live.js`, la pantalla `Mi-Suscripcion.html`,
el gate de prueba en `clinic-trial-gate.js`, y transferencia bancaria como
alternativa para quien no use PayPal. El alta pasa por
`crearClinicaSelfService`, que exige `aceptaTerminos === true` y deja
constancia en `/clinics/{id}.aceptacion`.

Lo que sigue abierto de esta fase no es código: **legalizar la empresa ante
el SAR (RTN de empresa + CAI)** para poder emitir factura deducible — ver
"Qué falta" abajo. Mientras tanto se opera con RTN personal y cuenta PayPal
Business a título personal.

### ⏳ Pendiente
Ver la **lista consolidada al final de este archivo** — las secciones de
abajo están ordenadas por cuándo se hizo cada cosa, no por qué queda, y los
pendientes quedaron repartidos entre ellas. El cierre del archivo los junta
en un solo lugar.

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

### ✅ Hecho — aislamiento entre clínicas en `/expedientes` (2026-10-02)

**El portal de paciente existe y está en producción**, a pesar de lo que dice
más arriba la nota del 2026-09-21 sobre el autoservicio removido:
`web/portal-paciente/` se despliega como el target de hosting
`ancla-paciente` del mismo proyecto `r3ads-clinic-crm`, con su propio login
(correo/contraseña y Google) y `Mi-Historial.html`. Esa nota describe el
borrado original; el portal se reconstruyó aparte el 2026-09-25.

**El agujero.** Hasta el 2026-10-02 la regla de lectura de
`/expedientes/{codigo}` cerraba con un `|| isAuth()` suelto, heredado de
CMG, donde el código de 6 caracteres hacía de control de acceso. En CMG era
una sola clínica; acá es un Firestore multi-tenant, así que esa rama dejaba
a **cualquier cuenta logueada leer el expediente de cualquier clínica** con
solo conocer el código — y el código va impreso en los PDF, viaja por
WhatsApp, no expira y no se puede rotar. Peor: la rama de reclamo permitía a
cualquiera ponerse como `ownerUid` de un expediente sin dueño, y con eso
quedaba leyendo también sus consultas, pruebas y laboratorios vía
`accesoPaciente()`. Era la única colección que rompía el aislamiento: las
demás ya filtraban por `clinicId` o por propiedad.

**El arreglo: la credencial pasa a ser el correo, no el código.**
- `firestore.rules` → lectura solo para staff de la clínica, el dueño
  (`ownerUid`) y quien esté en `compartidoCon`.
- Reclamar un expediente exige que el correo **verificado** de la cuenta
  coincida con `datosGenerales.email`, el campo que la clínica llena al
  abrir el expediente. El paciente no puede tocar ese campo (no está en el
  `hasOnly()` de su rama), así que quien vincula es, en efecto, la clínica.
- `email_verified` es parte del candado, no un extra: Firebase deja crear
  una cuenta con el correo de otro sin probar nada, así que
  `portal-paciente/Auth.html` ahora manda la verificación al registrarse y
  `Mi-Historial.html` muestra un aviso con botón de reenvío.
- Las solicitudes de acceso de un familiar se movieron del array
  `solicitudesAcceso` (que cualquiera con el código podía reescribir
  completo — las reglas no pueden validar el contenido de un `arrayUnion`)
  a la subcolección `/expedientes/{codigo}/solicitudes/{uid}`, donde el id
  del documento **es** el solicitante y la regla queda exacta.
- `Mi-Historial.html` ya no lee el expediente antes de vincular: intenta el
  reclamo a ciegas y, si las reglas lo rechazan, manda una solicitud. Un
  `permission-denied` no distingue entre "ese código no existe", "es de otra
  persona" y "tu correo no está registrado", a propósito. De paso se arregla
  que la pantalla de "solicitud pendiente" era cosmética: el expediente
  completo ya había llegado al navegador y solo se escondía con
  `display:none`.
- `Expediente-Doctor.html` avisa al entregar el código si el expediente
  nació sin correo, porque ese paciente no podrá verlo en línea.

**Desplegado y verificado (2026-10-08).** Esta sección decía "pendiente de
correr" y quedó así por no tacharla: las reglas se desplegaron el mismo
2026-10-02 (el log de auditoría de Cloud Functions lo registra a las
19:11Z, con `callerSuppliedUserAgent: FirebaseCLI/15.18.0
agent-name/claude_code`). El 2026-10-08 se volvió a correr el ciclo
completo para confirmarlo, y el CLI respondió `latest version of
firestore.rules already up to date, skipping upload` — o sea que el
agujero estaba cerrado en producción desde el día del cambio.

Lo que sí faltaba y se aplicó el 2026-10-08:
1. **Índices** — los dos compuestos de `/accesos` (`clinicId + ts` y
   `clinicId + codigoPaciente + ts`). Sin ellos `Bitacora.html` no carga.
2. **Functions** — 15 actualizadas; `crearClinicaSelfService` salió
   `Skipped (No changes detected)` porque ya estaba al día desde el 2 oct.
3. **Hosting de los dos portales** — staff en
   `https://r3ads-clinic-crm.web.app` (31 archivos, site por defecto) y
   paciente en `https://ancla-paciente.web.app` (target `paciente`).
4. **Auditoría de vinculaciones** — `node
   functions/auditar-vinculaciones-paciente.js` reportó **0 expedientes con
   dueño vinculado**, así que no hubo nada que corregir y `--aplicar` no se
   corrió. El agujero viejo nunca llegó a usarse. Vale repetir el script si
   alguna clínica de pago entra con pacientes ya vinculados de antes.

`firebase functions:log` quedó sin un solo error tras el despliegue.

### ✅ Hecho — términos de uso del portal de paciente (2026-10-02)

`portal-paciente/Terminos.html`, redactado sobre la Política de Privacidad
(misma hoja de estilo, mismo registro, referencias cruzadas a sus secciones
02, 07, 09, 10, 11, 12 y 15). Hasta ahora el paciente era usuario directo de
R3ads sin ningún documento que definiera la relación: solo existía la
política de privacidad, escrita cuando el producto era "solo staff".

Lo que delimita, además del encuadre normal (qué es el portal, qué no es,
uso aceptable, disponibilidad sin SLA, ley hondureña):
- **De qué no responde R3ads**: lo que el paciente divulgue — código,
  credenciales o archivos descargados —, el acceso de alguien a quien él
  mismo se lo aprobó, el contenido clínico que carga la clínica, y las
  decisiones médicas tomadas leyendo el portal.
- El texto describe el código **como lo que es desde el cambio de reglas**:
  un identificador, no una contraseña, que por sí solo no abre nada. Decir lo
  contrario sería describir un producto que ya no existe.
- La limitación no pretende excluir dolo, culpa grave ni los derechos
  irrenunciables de la Ley de Protección al Consumidor, que no se pueden
  excluir por contrato.

La aceptación se registra: casilla obligatoria en el alta (también cuando el
alta es con Google) y constancia en `/users/{uid}.aceptacion`
(`{ terminos: '2026-10-02', fecha }`). Al publicar una revisión sustancial
hay que subir `TERMINOS_VERSION` en `portal-paciente/Auth.html`, para saber
qué texto aceptó cada paciente y no solo que aceptó algo.

**Pendiente:** hacerlo revisar por un abogado en Honduras antes de tratarlo
como definitivo. El correo de contacto y la dirección física se completaron
el 2026-10-09 — ver la lista consolidada al final.

### ✅ Hecho — bitácora de acceso a expedientes (2026-10-02)

Hasta ahora no quedaba rastro de ninguna lectura: ante un reclamo de
filtración no había forma de decir quién vio un expediente, ni —lo que más
se necesita— de demostrar que nadie lo vio. La Política de Privacidad ya
afirmaba en su sección 02 que el acceso de soporte queda registrado.

**Colección `/accesos`**, append-only. `allow update, delete: if false` para
todos, incluidos el admin de la clínica y el superadmin: una bitácora que se
puede corregir no prueba nada. Solo el Admin SDK, que no pasa por las
reglas, podría purgarla. Las reglas además clavan `uid` al token y exigen
`ts == request.time`, así que nadie puede escribir una entrada a nombre de
otro ni fecharla a mano.

**Qué se registra** (`r3adsStaff.registrarAcceso` en `r3ads-staff.js`, y su
gemela dentro de `portal-paciente/Mi-Historial.html`):

| Acción | Dónde |
|---|---|
| `ver_expediente` | ficha del paciente en Buscar · y apertura desde el portal de paciente |
| `ver_historial` | historial clínico completo (consultas, pruebas, labs) |
| `exportar_zip` | descarga del expediente completo |
| `generar_word` | Word del expediente principal |

Guarda quién-qué-cuándo (`uid`, `email`, `rol`, `origen`, `codigoPaciente`),
nunca datos clínicos: la bitácora se conserva más que su utilidad inmediata
y no tiene sentido que duplique el expediente. El `rol` sale del custom
claim ya cacheado, no de una lectura de `/usuarios` — la bitácora no debe
costar un read por expediente abierto. Deduplica por (código, acción)
durante 10 minutos, porque si no cada re-render de una pestaña escribiría
otra entrada.

**Nunca interrumpe la atención.** Si la escritura falla, queda en consola y
la página sigue. Una bitácora que impide atender a un paciente se apaga el
primer día.

**`Bitacora.html`** — pantalla de solo lectura para el admin de la clínica
(tarjeta en `Inicio.html`, `soloAdmin`), con filtro por código de paciente y
paginación de 100. El médico y caja no entran: saber a qué expediente entró
un compañero no hace falta para atender, y esa pantalla cuenta dónde estuvo
cada quien durante el día.

**Qué prueba esto y qué no.** La escribe el mismo cliente que hace la
lectura, así que registra el uso del producto a través de sus pantallas — no
a alguien que hable con Firestore directo por el SDK y simplemente no
escriba la entrada. El complemento a prueba de manipulación son los **Data
Access logs de Google Cloud** (`DATA_READ` sobre Firestore), que se activan
en la consola del proyecto, viven fuera del alcance del cliente y **siguen
pendientes**. Esta bitácora es la que la clínica puede leer; aquella es la
que nadie puede tocar.

**La mitad que no se puede manipular ya está activa (2026-10-02).** Los Data
Access logs de Firestore (`ADMIN_READ`, `DATA_READ`, `DATA_WRITE` sobre
`firestore.googleapis.com`) quedaron encendidos en IAM → Registros de
auditoría, y los registros se enrutan a un bucket propio
(`auditoria-accesos`, retención **730 días**) por un sink filtrado a
`cloudaudit.googleapis.com/data_access` + `serviceName` de Firestore. El
`_Default` los sigue viendo 30 días; pasado eso hay que cambiar el alcance
del Logs Explorer a ese bucket para encontrarlos.

Esos logs los escribe Google, no el cliente, e identifican a quien leyó por
el token de Firebase (`protoPayload.authenticationInfo.thirdPartyPrincipal`
trae el header y el payload del JWT). Verificado el 2026-10-02 con una
lectura real desde el portal.

Consulta para buscarlos:

```
logName="projects/r3ads-clinic-crm/logs/cloudaudit.googleapis.com%2Fdata_access"
protoPayload.serviceName="firestore.googleapis.com"
```

**Pendiente:**
- Política de retención de `/accesos` (la bitácora de dentro de la app): hoy
  crece sin techo. La de Google ya tiene su ventana de 730 días; falta la
  equivalente acá, con un TTL de Firestore sobre un campo de vencimiento o
  una purga con el Admin SDK.
- Que el paciente pueda ver quién abrió su propio expediente. Hoy la lectura
  es solo del admin de su clínica y de R3ads; dárselo al titular exige una
  query que no se puede validar barato con las reglas actuales.
- El acceso de soporte de R3ads no entra acá, pero tampoco existe: las
  reglas no le dan al superadmin ningún acceso a expedientes (ver la nota en
  `firestore.rules`). La sección 02 de la política describe un acceso que el
  sistema no permite — vale ajustar ese texto.

### ✅ Hecho — contrato con la clínica y encargado del tratamiento (2026-10-02)

`portal-clinico/Terminos.html`: términos del servicio para la clínica que
paga, con el **Anexo A de encargado del tratamiento** dentro del mismo
documento. Hasta ahora el paciente tenía documento y el cliente que paga no
tenía nada — ni límite de responsabilidad, ni propiedad de los datos, ni qué
pasa si Ancla cierra, ni reparto de responsabilidades ante un incidente.

Decisiones que vale la pena no deshacer sin pensarlas:

- **Responsabilidad acotada a 12 meses de mensualidades**, con exclusión de
  lucro cesante y daños indirectos, y sin pretender excluir dolo ni culpa
  grave (una cláusula que llega tan lejos suele arrastrar al resto).
- **Sin SLA con penalidad.** Se dice explícitamente en vez de prometer un
  porcentaje que hoy no se podría sostener: no hay monitoreo ni alertas
  (punto 9 de la lista de riesgos).
- **Respaldos con los números reales** de `RESPALDOS.md` (PITR 7 días,
  diario 14 días, semanal 14 semanas, soft delete 30 días). Es cierto, y es
  de lo mejor que se puede mostrar en una venta.
- **Suspensión por impago no borra nada**, y así queda por escrito.
- **Salida**: exportación completa antes de eliminar, con aviso previo; y si
  R3ads discontinúa Ancla, 90 días de aviso. Es lo que más le preocupa a una
  clínica que entrega su historial a un proveedor de un solo operador.
- **Anexo A**: roles, instrucciones, subencargados (Google Cloud, PayPal,
  WhatsApp), transferencias fuera de Honduras, derechos de los pacientes,
  **notificación de incidentes dentro de las 72 h desde que R3ads tenga
  conocimiento**, devolución o eliminación al terminar, y derecho de la
  clínica a pedir información de cumplimiento.

**La aceptación se valida en el servidor, no solo en la casilla.**
`crearClinicaSelfService` exige `aceptaTerminos === true` y escribe
`/clinics/{id}.aceptacion` con `{ terminos, uid, email, fecha }` usando el
Admin SDK. Es el único camino para crear una clínica, así que no hay alta
sin constancia. Al publicar una revisión sustancial hay que subir
`TERMINOS_VERSION` en `functions/index.js`.

**Pendiente:**
- Revisión por un abogado en Honduras. El correo de contacto y la dirección
  física se completaron el 2026-10-09 — ver la lista consolidada al final.
- **Facturación**: la sección 05 dice que el comprobante se emite "conforme
  a las obligaciones fiscales aplicables", a propósito — sin RTN de empresa
  ni CAI no se puede prometer una factura deducible, que es justo lo que una
  clínica necesita para registrar el gasto. Es el punto 1 de la lista de
  riesgos y sigue abierto.
- Las clínicas creadas antes de hoy no tienen `aceptacion` en su documento.
  Si alguna llega a ser de pago, hay que recoger su aceptación aparte.

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
- **⚠️ `firestore.rules` editado (2026-09-21) pero NO redesplegado**
  — *nota 2026-10-08: advertencia superada. El archivo se editó y desplegó
  varias veces después, y el 2026-10-08 el CLI confirmó que lo desplegado
  coincide exactamente con lo que está en el repo. No queda nada pendiente
  de desplegar en reglas.* Se
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

---

## Qué falta — lista consolidada (al 2026-10-08)

Esta lista junta los pendientes que estaban repartidos por las secciones de
arriba. Lo marcado **(runtime)** no se puede verificar leyendo el repo: son
despliegues, scripts de una sola corrida y ajustes de consola. Si ya se
hicieron, tacharlos acá en vez de dejar que la duda se repita cada sesión.

**Nada queda pendiente de desplegar.** El 2026-10-08 se corrió el ciclo
completo (reglas, índices, functions, hosting de los dos portales) y la
auditoría de vinculaciones de paciente — ver el detalle en la sección del
2026-10-02 más arriba. Lo que sigue es todo configuración de consola,
trámite o código por escribir.

### 1. Infraestructura

- **`portal-clinico/firebase.json` no declara ningún `target` de hosting**,
  mientras `portal-paciente/.firebaserc` sí tiene `paciente → ancla-paciente`.
  Así, un `firebase deploy --only hosting` desde esta carpeta va al site por
  defecto del proyecto — confirmado el 2026-10-08: publicó 31 archivos en
  `r3ads-clinic-crm.web.app`. Funciona, pero conviene darle su propio
  target antes de que el proyecto tenga un tercer site: hoy, equivocarse de
  carpeta al desplegar sobrescribe el portal que no era.
- **Primer `superadmin`** — sin él `portal-admin.html` no deja entrar a
  nadie. El script `functions/otorgar-superadmin.js` ya está escrito para
  correrlo con el Admin SDK (a propósito no existe un camino desde la app).
  **(runtime)**
- **Exportar Firebase Auth periódicamente** (`firebase auth:export`) — las
  cuentas no entran en el PITR ni en los respaldos de Firestore, ver
  `RESPALDOS.md`.
- **Sin monitoreo ni alertas** — que un respaldo falle, o que el portal se
  caiga, hoy no avisa a nadie. Es la razón por la que `Terminos.html` dice
  explícitamente que no hay SLA con penalidad, y por la que hay que revisar
  `firebase firestore:backups:list` a mano.

### 2. Legal y fiscal

- **Revisión por un abogado en Honduras** de los tres documentos antes de
  tratarlos como definitivos. Es el único pendiente que les queda: el
  2026-10-09 se completaron los seis `[Completar: ...]` con
  `soporte@r3ads.com` (buzón ya montado) y con el domicilio completo
  —Residencial El Sauce, Villa Los Geranios, Bloque 44, Lote 3,
  Comayagüela, Francisco Morazán, Honduras—, se quitaron las tres "Nota
  interna" que se renderizaban a la vista del lector (la clase
  `.legal-note` no está oculta) y los dos portales se desplegaron.
- **RTN de empresa + CAI ante el SAR.** Sin eso no se puede prometer una
  factura deducible, que es justo lo que la clínica necesita para registrar
  el gasto. La sección 05 de `Terminos.html` está redactada a propósito sin
  prometerla.
- **Las clínicas creadas antes del 2026-10-02 no tienen `aceptacion`** en su
  documento. Si alguna pasa a ser de pago, hay que recoger su aceptación
  aparte.
- **La sección 02 de `Privacidad.html` describe un acceso de soporte de
  R3ads que las reglas no permiten** (el superadmin no tiene acceso a
  expedientes). Ajustar el texto para que describa el sistema real.

### 3. Producto y código

- **`SERVICIOS_SIN_PRECLINICA` sigue hardcodeado** en
  `Expediente-Doctor.html` (~línea 1588), con los 18 servicios del catálogo
  de CMG. Falta el campo de catálogo equivalente a `enfermeriaCompletable`
  para esta distinción.
- **Los 5 nombres de servicio siguen sin reconciliar** entre esa lista y
  `catalogo-servicios.js`: el catálogo tiene `Cirugía menor · pequeña/media/
  grande`, `Curación pequeña/mediana/grande`, `Retiro de puntos (cada uno)`
  y `Sueroterapia Glutatión`; la lista interna dice `Cirugía menor`,
  `Curación`, `Retiro de puntos` y `Aplicación de Suero`. Falla en modo
  seguro (exige médico), pero enfermería nunca podrá completarlos.
- **Las dos consultas de migración de datos legacy** de
  `Expediente-Doctor.html` ("vincular pruebas/exámenes viejos sin código de
  paciente") llevan `.where('clinicId', ...)` sin haberse probado nunca con
  una clínica real.
- **Retención de `/accesos`** — la bitácora de dentro de la app crece sin
  techo. La de Google ya tiene su ventana de 730 días; falta la equivalente
  acá, con un TTL de Firestore o una purga con el Admin SDK.
- **Que el paciente vea quién abrió su propio expediente.** Hoy
  `Bitacora.html` es solo para el admin de la clínica; dárselo al titular
  exige una query que las reglas actuales no validan barato.
- **Logo de Ancla** — la identidad de color está en
  `assets/portal-tokens.css`; el logo se diseñará con un diseñador.

### 4. Fases que quedan del plan

- **Fase 7 — piloto.** Dar de alta 1-2 clínicas reales (no CMG) por
  `portal-admin.html` y validar el aislamiento entre tenants colección por
  colección, con el Rules Playground o el emulador, antes de vender más
  suscripciones. No hay bloqueo técnico para la clínica #2 desde el
  2026-09-24.
- **Fase 8 — futuro.** Migrar CMG desde `clinica-medica-general` para ser el
  tenant #1 de Ancla, y reincorporar Doctor 365 como módulo opcional si
  alguna otra clínica lo pide.

*(La Fase 5 original —resolutor de subdominio por clínica— quedó eliminada
del plan el 2026-09-22, ver "Dominio" arriba.)*
