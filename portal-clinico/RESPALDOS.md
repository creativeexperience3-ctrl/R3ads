# Respaldos y recuperación — Ancla (`r3ads-clinic-crm`)

Configurado el **2026-09-29**. Antes de esa fecha el proyecto **no tenía
ningún respaldo**: la base de datos guardaba solo 1 hora de historial
(`versionRetentionPeriod: 3600s`, el mínimo de Firestore), no había copias
programadas, y la base se podía borrar con un solo comando. Son historiales
médicos: no se recrean.

---

## Qué hay protegido hoy

| Qué | Cómo | Ventana | Cubre |
|---|---|---|---|
| Firestore | Point-in-time recovery (PITR) | **7 días**, resolución de 1 minuto | Cualquier borrado o corrupción de datos |
| Firestore | Respaldo programado **diario** | **14 días** | Restaurar un día completo |
| Firestore | Respaldo programado **semanal** (domingos) | **14 semanas** (~3 meses) | Daño que se descubre tarde |
| Firestore | Delete protection | — | Que nadie borre la base entera por error |
| Storage (PDF, Word, imágenes) | Soft delete | **30 días** | Archivos borrados o sobrescritos |

Storage **no** entra en el PITR ni en los respaldos de Firestore: son dos
servicios distintos. Por eso el soft delete del bucket se subió de los 7 días
que trae Google por defecto a 30, para que la ventana de los archivos no sea
más corta que la de los datos que los referencian.

### Verificado, no solo configurado

El 2026-09-29 se comprobó que el PITR **responde de verdad**, no que esté
marcado en una consola: se contaron documentos de `/clinics` en el presente,
30 minutos atrás y 60 minutos atrás, y las tres lecturas devolvieron su
`readTime` exacto. Una lectura fuera de la ventana se rechaza con
`INVALID_ARGUMENT`, que es el comportamiento correcto.

```bash
# La misma comprobación, cuando se quiera repetir (no toca nada, solo lee):
#   POST .../documents:runAggregationQuery  con  {"readTime": "<ISO>"}
```

> **Los respaldos programados recién empiezan.** Las dos agendas se crearon el
> 2026-09-29; el primer respaldo diario aparece dentro de las 24 h siguientes y
> el primer semanal el domingo siguiente. Hasta entonces la única red es el
> PITR (que sí está activo desde ya) y el soft delete de Storage.

---

## Cómo recuperar

### Caso 1 — «se borró/corrompió algo y sé más o menos cuándo» (usar PITR)

Es el caso normal: un bug, un script, o alguien que borró lo que no debía. El
PITR clona la base tal como estaba en un minuto exacto, **en una base nueva**,
sin tocar la que está en producción.

```bash
firebase firestore:databases:clone "(default)" recuperacion-2026-09-29 \
  --snapshot-time 2026-09-29T11:45:00Z \
  --project r3ads-clinic-crm
```

Después: abrir la base `recuperacion-2026-09-29`, confirmar que los datos están
bien, y copiar de vuelta **solo lo que falta** a `(default)`. No se restaura
encima de producción (ver la nota de abajo).

El minuto más antiguo disponible se consulta con:

```bash
firebase firestore:databases:get "(default)" --project r3ads-clinic-crm --json
```

y se lee el campo `earliestVersionTime`.

### Caso 2 — «el daño es viejo o no sé cuándo pasó» (usar un respaldo)

```bash
# 1. Ver qué respaldos hay (nam5 es la región de esta base)
firebase firestore:backups:list --location nam5 --project r3ads-clinic-crm

# 2. Restaurar uno en una base NUEVA
firebase firestore:databases:restore \
  --database recuperacion-respaldo \
  --backup projects/r3ads-clinic-crm/locations/nam5/backups/<ID> \
  --project r3ads-clinic-crm
```

### Caso 3 — «se borró un PDF / una imagen de un expediente»

El bucket tiene soft delete de 30 días: el archivo sigue existiendo, marcado
como borrado, y se puede listar y restaurar por la API de Cloud Storage
(`softDeleted=true` al listar, y `restore` sobre el objeto). Aplica también a
los archivos **sobrescritos**, no solo a los borrados.

### Nota importante sobre restaurar

Ni `clone` ni `restore` escriben sobre una base que ya existe: las dos crean
una base nueva. Eso es a propósito y conviene — recuperar nunca debería poder
empeorar la situación. La consecuencia práctica es que el último paso siempre
es manual: comparar y copiar de la base recuperada a `(default)`.

Además `(default)` tiene **delete protection activo**, así que no se puede
borrar sin desactivarla primero:

```bash
firebase firestore:databases:update "(default)" --delete-protection DISABLED --project r3ads-clinic-crm
```

No desactivarla salvo que se sepa exactamente por qué.

---

## Lo que esto NO cubre

- **Firebase Authentication.** Los usuarios (correo, contraseña con hash) no
  entran en el PITR ni en los respaldos de Firestore. Si se borrara un usuario
  de Auth, sus datos en `/usuarios` y sus expedientes siguen ahí, pero la
  cuenta habría que volver a crearla. Exportar Auth periódicamente
  (`firebase auth:export`) queda pendiente.
- **Los secretos del 2FA** (`/seguridad2FA`) sí están en Firestore, así que
  entran en el PITR y en los respaldos. Restaurar una base vieja puede revivir
  un secreto TOTP ya rotado; en ese caso conviene que cada usuario afectado
  vuelva a activar su segundo factor.
- **Monitoreo.** Que un respaldo falle no avisa a nadie todavía (punto 9 del
  plan: no hay Sentry ni uptime monitor). Revisar
  `firebase firestore:backups:list` de vez en cuando hasta que haya alertas.

---

## Comandos de comprobación rápida

```bash
# Estado de PITR, retención y delete protection
firebase firestore:databases:get "(default)" --project r3ads-clinic-crm --json

# Agendas de respaldo configuradas
firebase firestore:backups:schedules:list --project r3ads-clinic-crm

# Respaldos que ya existen
firebase firestore:backups:list --location nam5 --project r3ads-clinic-crm
```
