# Ancla — Funnel de adquisición

Plan de adquisición de clínicas para **Ancla** (el SaaS de este repo).
Documento de trabajo: las casillas se van tachando.

- **Producto:** `ancla.r3ads.com` (Firebase `r3ads-clinic-crm`). Arquitectura
  y decisiones del producto → [`README.md`](README.md). Este archivo es solo
  marketing/adquisición.
- **Referencia base:** pizarra Canva *"B2B SaaS demo funnel 2026"*
  ([link](https://www.canva.com/design/DAHWakxctE8/tY_PvFWGfbCWr3gE8tXzJQ/edit)).
  Ese board es un funnel high-ticket; abajo se explica qué se adapta y qué se
  descarta, y por qué.
- **Booking:** Calendly (no Chili Piper — decidido 2026-10-09).
- Creado 2026-10-10.

---

## 1. Punto de partida

### Lo que ya está construido

| Pieza | Estado |
|---|---|
| Portal clínico + portal paciente | Desplegados |
| Autoservicio de alta | `Auth.html?view=register&plan=basico` / `&plan=completo` → `crearClinicaSelfService` |
| Prueba gratis | 7 días, **exige PayPal** para salir de `prueba_bloqueada` |
| Cobro | PayPal Subscriptions (migración Sandbox→Live en curso) |
| Precios | `Precios.html` |
| Materia prima de VSL | `Ancla_Webinar_Demo.pptx`, `anuncio.html` ("De Excel a un sistema real") |
| Legales para la landing | `Privacidad.html`, `Terminos.html` |

### Precios vigentes

| Plan | Mensual | Anual | Equivale a |
|---|---|---|---|
| Un consultorio (`basico`) | $40 | $400 | $33.33/mes |
| Completo (`completo`) | $65 | $650 | $54.17/mes |
| Varias sedes (Clínica+) | a consultar | — | — |

### El hueco que bloquea todo

**No hay tracking de ningún tipo.** Grep de `fbq(`, `gtag(`,
`googletagmanager`, `hyros`, `utm_source`, `fbclid` sobre todo `web/`: cero
resultados fuera de `node_modules`. No hay pixel, no hay analytics, y no se
guarda ni una UTM al registrarse.

> No se prende un solo anuncio hasta cerrar la Fase 0.

---

## 2. Decisión de fondo: dos carriles

El board de Canva es un funnel **high-ticket**: VSL larga → calificación →
llamada con closer → `Contract Out (verbal commitment)` → cierre. Existe
porque el ticket paga el tiempo de un humano por lead.

**Ancla cobra $40–65/mes.** Una demo call por registro no se paga: 45 min
entre la call y el follow-up se comen varios meses de suscripción antes de
cubrir el costo del anuncio.

La respuesta está dentro del mismo board, en dos nodos que ahí son ramas
secundarias: `Low Ticket Funnel` y `Redirect To Free Trial Landing Page`.
Para Ancla esos **son el camino principal**.

| | **Carril A — Autoservicio** | **Carril B — Demo call** |
|---|---|---|
| Para quién | 1 consultorio, 1–3 médicos | Varias sedes / Clínica+ / >5 usuarios |
| Camino | Ad → Landing+VSL → `Auth.html?view=register` → trial → cobro día 8 | Ad → Landing → Typeform → Calendly → demo → CRM |
| Plan | Básico / Completo | Clínica+ |
| Humano involucrado | Ninguno | Closer |
| Prioridad | **Primero** | Segunda vuelta |

El Typeform del board se queda, pero cambia de trabajo: ya no separa
"calificado / no calificado para comprar", sino **"se activa solo / hay que
hablarle"**. La pregunta que parte el funnel es *sedes y médicos*.

La rama `Unqualified → Free Trial` del board se invierte: acá el "no
calificado para call" es el cliente bueno de volumen, no el descarte.

---

## Fase 0 — Tracking *(bloquea todo)*

- [ ] Crear el **Dataset** en Meta Events Manager bajo el BM de R3ads.
- [ ] Instalar el pixel en **los dos hosts**: `r3ads.com` (GitHub Pages,
      `git push`) y `ancla.r3ads.com` (Firebase Hosting, `firebase deploy`).
      Son canales de despliegue distintos — ver el gotcha "push ≠ deploy".
- [ ] **Capturar atribución al registrarse.** Modificar
      `crearClinicaSelfService` (`functions/index.js`) para persistir en
      `/clinics/{clinicId}`: `utm_source`, `utm_medium`, `utm_campaign`,
      `utm_content`, `fbclid`, `_fbp`, `_fbc`, `landing_url`, `event_id`,
      `fecha_registro`. Son la única fuente de verdad de qué anuncio trajo
      qué clínica que **pagó**.
- [ ] Página de gracias propia post-registro, en dominio propio, donde
      dispara la conversión. No dejar la confirmación por defecto.

**Ventaja ya ganada:** los dos hosts cuelgan del mismo apex `r3ads.com`, así
que `_fbp`/`_fbc` sobreviven el salto landing → registro sin hacer nada. Es
justo el problema que el board resuelve a mano con hidden fields.

### Hyros: no contratarlo todavía

El board lo lleva en tres nodos (`Hyros URL Param`, `Hyros Tracking Pixel`,
`Hyros Ads`). Cuesta más por mes que lo que deja una clínica en Básico. Con
la atribución de primera mano en Firestore alcanza y sobra para este
volumen. Revisar cuando el gasto mensual en ads esté en varios miles.

---

## Fase 1 — Eventos de conversión

El evento estrella del board es `Schedule`. Acá no.

| Momento real | Evento Meta | Dónde dispara |
|---|---|---|
| Visita landing | `PageView` | navegador |
| Clic "Crear mi clínica" | `InitiateCheckout` | navegador |
| Clínica creada (`prueba_bloqueada`) | `Lead` | navegador + CAPI |
| Prueba activada con PayPal | `StartTrial` | **servidor** |
| Primer cobro real (día 8) | `Subscribe` + `value` | **servidor** |
| Demo agendada (carril B) | `Schedule` | Calendly → Zapier |

- [ ] Eventos de navegador con `event_id` generado en la landing.
- [ ] **CAPI desde `paypalWebhook`**, no desde Zapier. La Cloud Function ya
      recibe `BILLING.SUBSCRIPTION.ACTIVATED` y los eventos de cobro:
      mandar el CAPI desde ahí es server-side puro, sin intermediario, sin
      latencia y sin ad blockers. Más limpio que el board. Lee
      `_fbp`/`_fbc`/email de `/clinics/{clinicId}` — por eso la Fase 0 va
      antes.
- [ ] **Deduplicación:** el `event_id` de la landing viaja hasta Firestore y
      se usa idéntico en navegador y en CAPI. Sin esto Meta cuenta doble.
- [ ] Validar con `test_event_code` (Events Manager → Dataset → Test Events)
      antes de gastar.

**Qué optimizar:** con el volumen esperable en Honduras no se llega a 50
`Subscribe`/semana por conjunto, que es lo que Meta necesita para aprender.
Arrancar optimizando a **`Lead`**; usar `StartTrial` y `Subscribe` para
reportar y decidir, no para optimizar. Subir a `StartTrial` cuando el
volumen lo aguante.

---

## Fase 2 — La fricción del trial *(decisión pendiente)*

Hoy la prueba de 7 días **exige meter PayPal antes de guardar un solo
paciente**. La clínica se registra, entra, ve el banner de
`prueba_bloqueada` (`clinic-trial-gate.js`) y para hacer cualquier cosa
tiene que sacar la tarjeta.

Vendiéndole a dueños de consultorio en Honduras eso es un muro: baja
penetración de tarjeta, desconfianza con PayPal, y se pide el pago **antes**
de que vean valor. Se van a pagar clics que mueren en `Mi-Suscripcion.html`.

| Opción | Qué implica | Veredicto |
|---|---|---|
| **A — Prueba sin tarjeta, limitada** | Estado nuevo `prueba_libre` en `firestore.rules`: permite N pacientes/consultas reales; PayPal se pide al topar el límite o al día 7 | **Recomendada.** Es cambio de producto, pero es lo que más mueve la aguja |
| **B — Demo con datos de ejemplo** | Clínica sandbox precargada, sin registro | Barato, no toca las reglas |
| **C — Dejarlo como está** | Asumir baja conversión del carril A | Menor esfuerzo, peor economía |

> Esta decisión define qué landing se escribe y qué CTA va en el anuncio. Si
> sale A, el gancho pasa a ser *"probalo gratis 7 días, sin tarjeta"*, que es
> el doble de fuerte que lo que se puede decir hoy.

- [ ] **Decidir A / B / C.**

---

## Fase 3 — Páginas

- [ ] **Landing + VSL** (el `Opt-in Page + VSL Page` del board, en una sola
      página con el CTA repetido).
      - VSL de **4–7 min**, no 30. Fuente: `Ancla_Webinar_Demo.pptx`.
      - Guion: dolor del Excel y el papel → expediente real en pantalla →
        la caja cerrando la consulta → precio → CTA.
      - Ángulo ya escrito y bueno: *"De Excel a un sistema real"*
        (`anuncio.html`).
- [ ] **Confirmation / Objection Handling Page.** El nodo más valioso del
      board y el que no existe. Objeciones reales de una clínica hondureña:
      - "¿Y mis datos de pacientes dónde quedan?" → linkear `Privacidad.html`
        y `Terminos.html`, ya están escritos.
      - "¿Tengo que pasar todo lo viejo?" → migración.
      - "¿Y si no sé usar computadora?" → acompañamiento de alta.
      - "¿Puedo cancelar?" → sí, desde `Mi-Suscripcion.html`.
- [ ] **Landing de Clínica+** (varias sedes), con CTA a Calendly en vez de
      registro.

---

## Fase 4 — Calificación y booking *(carril B)*

- [ ] **Typeform de 4 preguntas:** ¿cuántas sedes? ¿cuántos médicos? ¿qué
      usás hoy (papel / Excel / otro sistema)? ¿cuándo querés empezar?
- [ ] **Ruteo:**
      - 1 sede, ≤3 médicos → `Auth.html?view=register&plan=basico`
      - 1 sede, 4+ médicos o viene de otro sistema → `plan=completo`
      - Varias sedes → **Calendly**
- [ ] **Calendly:**
      - Event type **Round Robin** con los closers (ese es el
        `Find Host Owner` del board; requiere plan de equipo — verificar).
      - Prefill por query params desde el Typeform (`?name=`, `?email=`,
        `?a1=`…), arrastrando también `_fbc`/`_fbp`/`event_id`: Calendly no
        los captura solo.
      - **Redirect post-booking a thank-you page propia** en `r3ads.com` (no
        la pantalla default). Ahí dispara `Schedule` y vive el objection
        handling.
- [ ] **Webhooks de Calendly → CRM:**

| Webhook | Stage |
|---|---|
| `invitee.created` | Call N°1 Booked |
| `invitee.canceled` | Call N°1 Cancelled |
| `invitee_no_show.created` | Call N°1 No Showed |

El no-show hay que marcarlo a mano en Calendly para que dispare — definir
quién lo hace y cuándo (sugerencia: el closer, mismo día).

---

## Fase 5 — CRM

- [ ] **Elegir CRM.** Recomendación: **HubSpot Free** — pipelines de deals,
      integración nativa con Calendly y Zapier, sin costo. *No* montarlo
      sobre Firestore: mezclar el CRM comercial con la base del producto va
      a doler.
- [ ] **Pipeline carril B** (los stages del board):
      `Lead Not Booked` → `Call N°1 Booked` → `No Showed` / `Cancelled` →
      `Call N°2 Booked` → `Contract Out (verbal commitment)` →
      `Deal Closed` / `Deal Not Closed`, con `Long Term Nurture` como salida
      lateral.
- [ ] **Pipeline carril A** (no está en el board, hace falta):
      `Registrado (prueba_bloqueada)` → `Prueba activada` → `Pagó mes 1` →
      `Churn`. Alimentado por `paypalWebhook`, no por Zapier.
- [ ] **Zap de deal owner** (igual al board): host de Calendly → buscar
      contacto y deal → asignarlo como owner.

---

## Fase 6 — Secuencias

- [ ] **Pre-call (carril B):** recordatorios email + SMS/WhatsApp desde
      **Workflows de Calendly** — van atados al horario real y se reajustan
      solos si reprograman. No duplicarlos en el ESP.
- [ ] **Activación (carril A) — la que más plata deja.** La clínica que se
      registró y **no** activó la prueba es el segmento más caliente y hoy no
      recibe nada. Secuencia día 0 / 1 / 3 / 6 por email + WhatsApp,
      disparada por `estado == 'prueba_bloqueada'`.
- [ ] **Día 5–7 de prueba:** aviso de que arranca el cobro, con lo que
      lograron en la semana. Reduce disputas y churn.
- [ ] **Churn:** `BILLING.SUBSCRIPTION.CANCELLED` y `.SUSPENDED` ya llegan al
      webhook → secuencia de recuperación. `suspendida` casi siempre es
      tarjeta fallida, no decisión: se recupera con un solo mensaje.

---

## Fase 7 — Ads

- [ ] **Oferta del anuncio** — depende 100% de la Fase 2.
- [ ] **Estructura:** 1 campaña de conversiones a `Lead`, 2–3 conjuntos
      (intereses médicos/salud en Honduras · lookalike cuando haya datos ·
      retargeting de visitantes de `Precios.html`).
- [ ] **Creativos:** screen recordings del portal real. Se vende orden contra
      el caos del papel: mostrarlo gana a cualquier gráfico.
- [ ] **Retargeting específico:** público de quienes llegaron a
      `Mi-Suscripcion.html` y no activaron. El público más barato de
      convertir que va a haber.

---

## Orden de ejecución

```
Fase 0 (tracking) → Fase 2 (decidir fricción del trial) → Fase 3 (páginas)
→ Fase 1 (eventos CAPI) → Fase 5 (CRM) → Fase 4 (Typeform + Calendly)
→ Fase 6 (secuencias) → Fase 7 (ads en vivo)
```

Las fases **0, 1 y 2** son las únicas que bloquean de verdad. Las 4 y 5 solo
hacen falta cuando llegue tráfico de varias sedes: para validar rápido,
prender el carril A solo y sumar el B en la segunda vuelta.

---

## Pendientes de decisión

1. **Fase 2: ¿A, B o C?** Es lo que más cambia el resto del plan.
2. **CRM:** ¿HubSpot Free u otro?
3. **Presupuesto mensual de ads** — define si el carril B tiene sentido desde
   el día uno o es para después.
