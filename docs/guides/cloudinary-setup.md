# Configuración de Cloudinary

Guía completa para configurar y usar Cloudinary como servicio de almacenamiento de materiales publicitarios (imágenes y videos) para los gabinetes de power banks.

## Tabla de Contenidos

- [¿Por qué Cloudinary?](#por-qué-cloudinary)
- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Configuración Inicial](#configuración-inicial)
- [API Endpoints](#api-endpoints)
- [Eliminación Automática](#eliminación-automática)
- [Seguridad](#seguridad)
- [Límites y Restricciones](#límites-y-restricciones)
- [Solución de Problemas](#solución-de-problemas)

---

## ¿Por qué Cloudinary?

Cloudinary es un servicio de gestión de medios en la nube que ofrece:

| Característica | Descripción |
|----------------|-------------|
| 🔒 **Almacenamiento seguro** | Gestión confiable de imágenes y videos |
| 🌐 **URLs HTTPS permanentes** | Requerido por la API de WsCharge |
| ⚡ **CDN global** | Carga rápida desde cualquier ubicación |
| 🎨 **Optimización automática** | Compresión y transformaciones on-the-fly |
| 💰 **Plan gratuito generoso** | 25 GB almacenamiento + 25 GB bandwidth/mes |

---

## Arquitectura del Sistema

### Flujo de Upload y Eliminación

```
┌──────────┐      ┌──────────┐      ┌────────────┐      ┌──────────┐
│ Frontend │      │  Backend │      │ Cloudinary │      │ WsCharge │
└──────────┘      └──────────┘      └────────────┘      └──────────┘

UPLOAD:
    │                  │                   │                  │
    │ 1. POST file     │                   │                  │
    ├─────────────────▶│                   │                  │
    │                  │ 2. Upload file    │                  │
    │                  ├──────────────────▶│                  │
    │                  │ 3. Return URL     │                  │
    │                  ◀──────────────────┤                  │
    │ 4. Return URL    │                   │                  │
    ◀─────────────────┤                   │                  │
    │                  │                   │                  │
    │ 5. Create material with URL          │                  │
    ├─────────────────────────────────────┼─────────────────▶│
    │                  │                   │                  │

DELETE:
    │                  │                   │                  │
    │ 6. DELETE mat.   │                   │                  │
    ├─────────────────▶│                   │                  │
    │                  │ 7. Get mat. info  │                  │
    │                  ├─────────────────────────────────────▶│
    │                  │ 8. Mat. info      │                  │
    │                  ◀─────────────────────────────────────┤
    │                  │ 9. Delete mat.    │                  │
    │                  ├─────────────────────────────────────▶│
    │                  │ 10. Delete file   │                  │
    │                  ├──────────────────▶│                  │
    │ 11. Success      │                   │                  │
    ◀─────────────────┤                   │                  │
```

### Ventajas de este Enfoque

- 🔒 **Seguro**: Credenciales nunca expuestas en el frontend
- ✅ **Control total**: Validación completa antes de subir
- 📊 **Auditoría**: Logging de quién sube qué y cuándo
- 🧹 **Limpieza automática**: Eliminación en Cloudinary al borrar de WsCharge
- 🚫 **Sin archivos huérfanos**: Gestión del ciclo de vida completo
- 🔄 **Sincronización**: Backend mantiene ambos servicios sincronizados

---

## Configuración Inicial

### 1. Crear Cuenta en Cloudinary

1. Visita [https://cloudinary.com/users/register_free](https://cloudinary.com/users/register_free)
2. Regístrate con tu email (plan gratuito suficiente para empezar)
3. Confirma tu email

### 2. Obtener Credenciales

1. Ingresa al [Dashboard de Cloudinary](https://console.cloudinary.com/)
2. En la página principal encontrarás:
   - **Cloud Name**: Tu identificador único (ej: `dxyz123abc`)
   - **API Key**: Tu clave pública (ej: `123456789012345`)
   - **API Secret**: Tu clave secreta (clic en "Reveal" para verla)

⚠️ **IMPORTANTE**: Nunca compartas tu API Secret públicamente ni lo subas a Git.

### 3. Configurar Variables de Entorno

Edita el archivo `.env` en el directorio `backend/`:

```env
# Cloudinary Configuration (for material uploads)
CLOUDINARY_CLOUD_NAME=dxyz123abc
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=ABCdef123GHI456jkl
CLOUDINARY_FOLDER=power-bank-materials
```

**Descripción de las variables:**

| Variable | Descripción | Obligatorio |
|----------|-------------|-------------|
| `CLOUDINARY_CLOUD_NAME` | Tu Cloud Name de Cloudinary | ✅ Sí |
| `CLOUDINARY_API_KEY` | Tu API Key pública | ✅ Sí |
| `CLOUDINARY_API_SECRET` | Tu API Secret (¡SECRETO!) | ✅ Sí |
| `CLOUDINARY_FOLDER` | Carpeta donde se guardan archivos | ⭕ No (default: `power-bank-materials`) |

### 4. Reiniciar el Servidor

Después de modificar el `.env`, reinicia tu servidor:

```bash
cd backend
pnpm run dev
```

---

## API Endpoints

### Upload de Material

**Endpoint:** `POST /api/v1/upload/material`

Sube un archivo (imagen o video) a Cloudinary.

**Headers:**
```http
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: [archivo imagen o video]
```

**Response exitoso (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/xxx/image/upload/v123/power-bank-materials/file.jpg",
    "publicId": "power-bank-materials/file",
    "format": "jpg",
    "resourceType": "image",
    "width": 1920,
    "height": 1080,
    "bytes": 234567,
    "originalName": "file.jpg",
    "mimetype": "image/jpeg"
  }
}
```

**Errores comunes:**
- `400`: No se proporcionó archivo
- `401`: Token de autenticación inválido o expirado
- `500`: Error al subir a Cloudinary o servicio no configurado

### Eliminación de Material

**Endpoint:** `DELETE /api/v1/upload/material/:publicId`

Elimina un archivo específico de Cloudinary.

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Query params:**
```
resourceType: "image" | "video"  (default: "image")
```

**Response exitoso (200):**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Errores comunes:**
- `400`: Public ID no proporcionado
- `401`: Token de autenticación inválido
- `404`: Archivo no encontrado
- `500`: Error al eliminar de Cloudinary

---

## Eliminación Automática

El backend implementa eliminación automática de archivos de Cloudinary cuando se elimina un material de WsCharge.

### Cómo Funciona

1. **Usuario elimina material** desde el frontend
2. **Backend obtiene información** del material (URL y tipo)
3. **Backend elimina de WsCharge** primero
4. **Backend elimina de Cloudinary** automáticamente si:
   - ✅ La URL es de Cloudinary
   - ✅ Cloudinary está configurado
   - ✅ Se puede extraer el `publicId` de la URL

### Características

- 🔄 **No bloquea**: Si falla la eliminación de Cloudinary, no falla la operación principal
- 📝 **Logging completo**: Todos los pasos se registran para debugging
- 🎯 **Selectivo**: Solo elimina de Cloudinary si la URL es de ese servicio
- 🛡️ **Seguro**: Manejo de errores robusto

### Ejemplo de Logs

```
INFO: Eliminando material publicitario { id: 123 }
INFO: Material encontrado para eliminación de Cloudinary {
  id: 123,
  url: "https://res.cloudinary.com/.../file.jpg",
  type: "image"
}
INFO: Material publicitario eliminado exitosamente { id: 123 }
INFO: Archivo eliminado exitosamente de Cloudinary {
  publicId: "power-bank-materials/file",
  resourceType: "image"
}
```

---

## Seguridad

### Medidas Implementadas

| Medida | Descripción |
|--------|-------------|
| 🔐 **Credenciales protegidas** | API Secret solo en backend, nunca expuesto |
| 👤 **Autenticación JWT** | Solo usuarios autenticados pueden subir/eliminar |
| ✅ **Validación de archivos** | Tipo y tamaño validados antes de upload |
| 📏 **Límites de tamaño** | Máximo 50MB por archivo |
| 🎭 **Tipos permitidos** | Solo imágenes y videos específicos |
| 🚦 **Rate limiting** | Previene abuso del servicio |

### Validaciones en el Backend

```typescript
// Tipos de archivo permitidos
const allowedMimeTypes = [
  // Imágenes
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Videos
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo'
];

// Tamaño máximo: 50MB
const maxFileSize = 50 * 1024 * 1024;
```

---

## Límites y Restricciones

### Límites del Backend

| Límite | Valor | Configurable en |
|--------|-------|-----------------|
| Tamaño máximo | 50 MB | `upload.middleware.ts` |
| Archivos por request | 1 archivo | `upload.middleware.ts` |
| Tipos de imagen | JPEG, PNG, GIF, WebP | `upload.middleware.ts` |
| Tipos de video | MP4, MOV, WebM, AVI | `upload.middleware.ts` |

### Plan Gratuito de Cloudinary

| Recurso | Límite Mensual |
|---------|----------------|
| 📦 Almacenamiento | 25 GB |
| 🌐 Bandwidth | 25 GB |
| 🔄 Transformaciones | 25,000 |
| 📊 Créditos | $0 (gratis) |

💡 **Tip**: Monitorea tu uso desde el [Dashboard de Cloudinary](https://console.cloudinary.com/) para evitar sorpresas.

---

## Solución de Problemas

### "Upload service is not configured"

**Causa**: Variables de entorno de Cloudinary no configuradas.

**Solución**:
1. Verifica que `.env` tenga las 3 variables requeridas
2. Confirma que no haya espacios extras en los valores
3. Reinicia el servidor después de modificar `.env`

```bash
# Verifica las variables
grep CLOUDINARY .env

# Reinicia el servidor
pnpm run dev
```

### "Cloudinary upload failed"

**Causa**: Credenciales incorrectas o cuenta inactiva.

**Solución**:
1. Verifica las credenciales en el Dashboard de Cloudinary
2. Copia y pega cuidadosamente (sin espacios)
3. Confirma que tu cuenta esté activa
4. Revisa los logs del servidor para más detalles

### "File size too large"

**Causa**: Archivo excede el límite de 50MB.

**Solución**:
1. Comprime el archivo antes de subirlo
2. O ajusta el límite en `src/middleware/upload.middleware.ts`:

```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // Cambiar a 100MB
  },
  // ...
});
```

### "Invalid file type"

**Causa**: Tipo de archivo no permitido.

**Solución**:
1. Verifica que sea imagen (JPEG, PNG, GIF, WebP) o video (MP4, MOV, WebM, AVI)
2. Si necesitas agregar más tipos, edita `upload.middleware.ts`:

```typescript
const allowedMimeTypes = [
  // ... tipos existentes
  'image/svg+xml',  // Agregar SVG
  'video/x-matroska', // Agregar MKV
];
```

### Material eliminado de WsCharge pero no de Cloudinary

**Causa**: Cloudinary no configurado o URL no es de Cloudinary.

**Solución**:
1. Verifica logs del servidor para ver el motivo
2. Si Cloudinary no está configurado, la eliminación automática se omite
3. Puedes eliminar manualmente desde el Dashboard de Cloudinary
4. O usar el endpoint: `DELETE /api/v1/upload/material/:publicId?resourceType=image`

---

## Despliegue en Producción

### Variables de Entorno

Si usas **Railway**, **Vercel**, **Heroku**, etc:

1. Ve a la sección de **Environment Variables**
2. Agrega las 4 variables de Cloudinary:
   ```
   CLOUDINARY_CLOUD_NAME=tu_cloud_name
   CLOUDINARY_API_KEY=tu_api_key
   CLOUDINARY_API_SECRET=tu_api_secret
   CLOUDINARY_FOLDER=power-bank-materials
   ```
3. Redeploy tu aplicación

### Consideraciones de Producción

- 🔒 **Nunca subas** el `.env` a Git
- 📊 **Monitorea el uso** desde el Dashboard de Cloudinary
- 💰 **Upgrade si es necesario**: Si superas el plan gratuito
- 🧹 **Limpieza periódica**: Elimina archivos no utilizados
- 🚨 **Alertas**: Configura alertas en Cloudinary para límites
- 📈 **Escalabilidad**: Considera plan de pago si creces

### Backup y Recuperación

Cloudinary mantiene tus archivos seguros, pero considera:

1. **Backup de URLs**: Guarda las URLs en tu base de datos
2. **Documentación**: Mantén registro de materiales importantes
3. **Plan de pago**: Incluye backup automático y recuperación

---

## Organización de Archivos

### Estructura en Cloudinary

```
cloudinary://
└── power-bank-materials/          # Carpeta principal (configurable)
    ├── abc123def456_image1.jpg    # Nombres únicos auto-generados
    ├── ghi789jkl012_video1.mp4
    ├── mno345pqr678_image2.png
    └── ...
```

### Características

- 📁 **Carpeta única**: Todos los materiales en `power-bank-materials/`
- 🔢 **IDs únicos**: Cloudinary genera identificadores únicos
- 🔗 **URLs permanentes**: Una vez subido, la URL no cambia
- 🗂️ **Metadata**: Cloudinary guarda información del archivo

---

## Flujo de Uso Completo

### Desde el Frontend

1. **Usuario** abre modal "Agregar Material"
2. **Usuario** selecciona archivo o pega URL
3. Si selecciona archivo:
   - Frontend valida tipo y tamaño
   - Frontend muestra vista previa
   - Usuario hace clic en "Subir"
   - Frontend envía a `POST /api/v1/upload/material`
4. Backend sube a Cloudinary y retorna URL
5. Frontend usa URL para crear material en WsCharge

### Eliminación

1. **Usuario** elimina material desde frontend
2. Frontend envía a `DELETE /api/v1/wscharge/screen/materials/:id`
3. Backend:
   - Obtiene info del material (URL)
   - Elimina de WsCharge
   - Elimina de Cloudinary automáticamente
4. Frontend actualiza lista de materiales

---

## Recursos Adicionales

### Documentación Oficial

- 📖 [Documentación de Cloudinary](https://cloudinary.com/documentation)
- 🔧 [Upload API Reference](https://cloudinary.com/documentation/image_upload_api_reference)
- 💻 [Node.js SDK](https://cloudinary.com/documentation/node_integration)
- 🎓 [Cloudinary Academy](https://training.cloudinary.com/)

### Soporte

- 💬 [Cloudinary Community](https://community.cloudinary.com/)
- 📧 [Support Email](mailto:support@cloudinary.com)
- 🐛 [GitHub Issues](https://github.com/cloudinary/cloudinary_npm/issues)

### Herramientas Útiles

- 🖼️ [Media Library](https://cloudinary.com/documentation/media_library_widget): Widget para gestionar archivos
- 🎨 [Transformation Builder](https://cloudinary.com/documentation/transformation_reference): Constructor visual
- 📊 [Analytics Dashboard](https://console.cloudinary.com/): Monitoreo de uso
