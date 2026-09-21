# 🩺 Sistema de Historial Médico CMG

Sistema completo de expedientes clínicos electrónicos integrado con Firebase
Authentication, Firestore y Storage.

---

## 📂 Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `Expediente-Doctor.html` | Portal del médico (crea expedientes, registra consultas) |
| `Mi-Historial.html` | Portal del paciente (ve su historial cronológico) |
| `Mis-Cotizaciones.html` | Actualizado con botones "Mi Historial Médico" y "Portal Médico" |
| `firestore.rules` | Reglas de seguridad de Firestore |
| `storage.rules` | Reglas de seguridad de Firebase Storage |

---

## 🔄 Flujo del sistema

### Para el **Doctor** (`expedientes.clinicamedicacmg@gmail.com`):

1. Inicia sesión con su cuenta en `Auth.html`
2. Desde "Mis Cotizaciones" pulsa **🩺 Portal Médico** (botón amarillo)
3. En `Expediente-Doctor.html` puede:
   - **Crear Nuevo Expediente** → genera código único `CMG-XXXXXX`
   - **Buscar Paciente** por código
   - **Editar Expediente** (datos generales, antecedentes)
   - **Nueva Consulta** → genera y guarda PDF automáticamente
   - **Ver Historial** → lista cronológica + descarga PDF + genera Word

### Para el **Paciente**:

1. Crea cuenta normal en `Auth.html`
2. Va a "Mis Cotizaciones" → pulsa **📋 Mi Historial Médico**
3. En `Mi-Historial.html`:
   - Si no tiene código → ingresa el código que le dio el doctor
   - El expediente queda vinculado a su cuenta (`ownerUid`)
   - Ve sus datos generales, antecedentes, y todas las consultas
4. Puede **copiar y compartir su código** con familiares
5. Un familiar puede ingresar ese código y verá el expediente como
   "compartido conmigo" (se guarda en su lista `codigosCompartidos`)

---

## 🗄️ Modelo de datos en Firestore

### Colección `expedientes`
Document ID = código del paciente (ej: `CMG-A7K9M2`)
```json
{
  "codigoPaciente": "CMG-A7K9M2",
  "ownerUid": "uid-del-paciente-cuando-lo-vincule",
  "ownerEmail": "paciente@correo.com",
  "ownerVinculado": true,
  "compartidoCon": ["uid-familiar-1", "uid-familiar-2"],
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>",
  "createdByEmail": "expedientes.clinicamedicacmg@gmail.com",
  "datosGenerales": {
    "nombreCompleto", "fechaNacimiento", "sexo", "tipoSangre",
    "telefono", "email", "estadoCivil", "ocupacion", "escolaridad",
    "religion", "lugarNacimiento", "direccion",
    "contactoEmergencia", "telefonoEmergencia", "alergias"
  },
  "antecedentesPatologicos": {
    "Diabetes mellitus": { "tiene": true, "detalle": "Tipo 2, 5 años" },
    "...": {...}
  },
  "antecedentesNoPatologicos": {...},
  "antecedentesFamiliares": "texto libre",
  "wordExpedienteUrl": "https://firebasestorage..."
}
```

### Colección `consultas`
Document ID = auto-generado
```json
{
  "codigoPaciente": "CMG-A7K9M2",
  "fecha": "<timestamp>",
  "doctorEmail": "expedientes.clinicamedicacmg@gmail.com",
  "doctorNombre": "Dr. Juan Pérez",
  "signosVitales": { "ta", "fc", "fr", "temp", "peso", "talla", "spo2", "glucosa" },
  "motivoConsulta": "...",
  "sintomas": "...",
  "exploracion": "...",
  "diagnostico": "...",
  "tratamiento": "...",
  "indicaciones": "...",
  "proximaCita": "2026-06-15",
  "pdfUrl": "https://firebasestorage...",
  "storagePath": "expedientes/CMG-A7K9M2/consultas/2026-05-23-14-30-00.pdf"
}
```

### Colección `users`
Document ID = uid del usuario
```json
{
  "email": "paciente@correo.com",
  "codigoExpediente": "CMG-A7K9M2",
  "codigosCompartidos": ["CMG-BX2YR7", "CMG-PZQ8K3"],
  "updatedAt": "<timestamp>"
}
```

### Estructura Firebase Storage
```
/expedientes/
  /{codigoPaciente}/
    /expediente-principal.docx       ← Word del expediente clínico
    /consultas/
      /2026-05-23-14-30-00.pdf       ← PDF de cada consulta
      /2026-06-15-10-15-00.pdf
```

---

## 🔒 Reglas de seguridad

### Firestore (`firestore.rules`)
- **Doctores autorizados**: acceso completo a `expedientes` y `consultas`
- **Pacientes**: leen solo expedientes propios o compartidos con ellos
- **Pacientes**: pueden reclamar un expediente sin owner asignándose como ownerUid
- **Pacientes**: pueden agregarse a `compartidoCon` (sin modificar otros campos)

### Storage (`storage.rules`)
- **Lectura**: cualquier usuario autenticado (URL secreta protegida por Firestore)
- **Escritura**: solo doctores autorizados

---

## ⚙️ Despliegue de reglas (PASO CRÍTICO)

Las reglas deben publicarse en Firebase Console o vía CLI. **El sistema no
funcionará correctamente hasta que despliegues las reglas.**

### Opción A — Vía Firebase Console (más fácil)

1. **Firestore Rules**:
   - Ve a https://console.firebase.google.com/project/clinica-medica-general/firestore/rules
   - Copia el contenido de `firestore.rules` y pega en el editor
   - Pulsa **Publicar**

2. **Storage Rules**:
   - Ve a https://console.firebase.google.com/project/clinica-medica-general/storage/rules
   - Si **Storage no está habilitado**, primero habilítalo (gratis hasta 5 GB)
   - Copia el contenido de `storage.rules` y pega en el editor
   - Pulsa **Publicar**

### Opción B — Vía Firebase CLI

```bash
# Instalar Firebase CLI (una sola vez)
npm install -g firebase-tools

# Login
firebase login

# En la raíz del proyecto:
firebase init firestore   # selecciona el proyecto, acepta defaults
firebase init storage     # selecciona el proyecto, acepta defaults

# Publicar reglas
firebase deploy --only firestore:rules
firebase deploy --only storage
```

---

## 📋 Lista de verificación post-despliegue

- [ ] Habilitar **Firebase Storage** en consola (si no estaba)
- [ ] Publicar `firestore.rules`
- [ ] Publicar `storage.rules`
- [ ] Crear cuenta en `Auth.html` con `expedientes.clinicamedicacmg@gmail.com`
- [ ] Probar crear nuevo expediente en `Expediente-Doctor.html`
- [ ] Probar buscar expediente por código
- [ ] Probar registrar nueva consulta (debe generar PDF)
- [ ] Probar generar Word del expediente
- [ ] Crear cuenta de prueba como paciente
- [ ] Vincular el código del expediente al paciente
- [ ] Verificar que el paciente ve su historial completo
- [ ] Compartir código con otro usuario de prueba
- [ ] Verificar que el segundo usuario ve el expediente como "compartido"

---

## 🎨 Personalizaciones futuras (opcional)

- **Notificaciones por correo** cuando se registra una nueva consulta
- **Recordatorios automáticos** de próximas citas
- **Subida de archivos adjuntos** (resultados de laboratorio, radiografías)
- **Firma digital** en los PDFs
- **Exportar historial completo** a un solo ZIP
- **Búsqueda avanzada** por nombre, diagnóstico, fecha

---

## 🆘 Soporte

Para añadir nuevos doctores autorizados, edita la constante `DOCTOR_EMAILS` en:
- `Expediente-Doctor.html` (línea ~485)
- `Mis-Cotizaciones.html` (en el bloque de auth)
- `firestore.rules` (función `isDoctor()`)
- `storage.rules` (función `isDoctor()`)
