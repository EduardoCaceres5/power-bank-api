# WsCharge API Authentication Guide

## Resumen

El servicio de WsCharge API ahora maneja la autenticación **automáticamente** usando las credenciales configuradas en las variables de entorno. Ya no necesitas llamar manualmente el endpoint de login para cada sesión.

## Configuración Requerida

### Variables de Entorno Obligatorias

Agrega estas variables a tu archivo `.env`:

```env
# WsCharge HTTP API Configuration
WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=tu_operator_code          # Proporcionado por WsCharge
WSCHARGE_USERNAME=tu_usuario             # Tu cuenta de WsCharge
WSCHARGE_PASSWORD=tu_contraseña          # Tu contraseña de WsCharge
```

### ¿Qué es cada variable?

1. **`WSCHARGE_OCODE`** (Operator Code):
   - Identificador único de operador
   - Te lo proporciona WsCharge cuando contratas el servicio
   - **Requerido para TODAS las peticiones** (incluido login)
   - Ejemplo: `"test"`, `"operator123"`

2. **`WSCHARGE_USERNAME`**:
   - Tu nombre de usuario de la cuenta WsCharge
   - Usado para auto-login

3. **`WSCHARGE_PASSWORD`**:
   - Tu contraseña de la cuenta WsCharge
   - Usado para auto-login

## Cómo Funciona

### 1. Auto-Login en el Inicio

Cuando el servidor inicia, el servicio de WsCharge API:

```typescript
// Se ejecuta automáticamente al iniciar el servidor
wsChargeApiService.initialize()
  ✓ Lee las credenciales del .env
  ✓ Hace login automático
  ✓ Guarda el token (válido por 30 minutos)
  ✓ El servidor está listo para usar
```

**Logs que verás:**

```
[info]: WsCharge API Service initialized
[info]: Initializing WsCharge API service with auto-login
[info]: Attempting to login to WsCharge API
[info]: Successfully logged in to WsCharge API
```

### 2. Auto-Login en Cada Request

Si el token expira o no existe, el servicio hace auto-login automáticamente:

```typescript
// Cuando llamas cualquier endpoint
GET /api/v1/wscharge/cabinets
  ↓
  ✓ Verifica si hay token válido
  ✗ Token expirado o no existe
  ↓
  ✓ Auto-login con credenciales del .env
  ✓ Obtiene nuevo token
  ✓ Ejecuta la petición original
  ↓
  ✓ Retorna los datos solicitados
```

**Logs que verás:**

```
[info]: Not authenticated, attempting auto-login with environment credentials
[info]: Successfully logged in to WsCharge API
[info]: Getting cabinet list
```

### 3. Renovación Automática de Token

El token tiene una validez de **30 minutos**. El servicio:

- ✅ Verifica automáticamente si el token es válido antes de cada request
- ✅ Hace re-login automático si el token expiró
- ✅ Reinicia el tiempo de expiración en cada request exitoso a la API de WsCharge
- ✅ Todo es transparente para tu aplicación

## Uso de los Endpoints

### Ya NO necesitas hacer login manualmente

❌ **ANTES (No recomendado):**
```bash
# 1. Login manual
POST /api/v1/wscharge/auth/login
{
  "name": "usuario",
  "password": "password"
}

# 2. Usar otros endpoints
GET /api/v1/wscharge/cabinets
```

✅ **AHORA (Automático):**
```bash
# Simplemente usa cualquier endpoint directamente
GET /api/v1/wscharge/cabinets
# El login se hace automáticamente si es necesario
```

### Endpoint de Login Manual (Opcional)

El endpoint de login todavía existe para casos especiales:

```http
POST /api/v1/wscharge/auth/login
Content-Type: application/json

{
  "name": "otro_usuario",
  "password": "otra_password"
}
```

**Cuándo usar el login manual:**
- ✅ Para hacer login con credenciales diferentes a las del `.env`
- ✅ Para forzar un re-login inmediato
- ✅ Para testing o desarrollo
- ❌ **NO es necesario** para uso normal

### Verificar Estado de Autenticación

```http
GET /api/v1/wscharge/auth/status

Response:
{
  "success": true,
  "data": {
    "authenticated": true  // o false
  }
}
```

## Ejemplos de Uso

### Ejemplo 1: Usar directamente cualquier endpoint

```typescript
// En tu código frontend o cliente API
const response = await fetch('http://localhost:3000/api/v1/wscharge/cabinets?page=1');
const data = await response.json();

console.log('Gabinetes:', data.data.list);
// El auto-login ya se hizo si fue necesario, todo transparente
```

### Ejemplo 2: Chain de múltiples requests

```typescript
// Todos estos requests funcionan sin login manual
async function getCabinetInfo() {
  // 1. Obtener lista de gabinetes
  const cabinets = await fetch('/api/v1/wscharge/cabinets').then(r => r.json());

  // 2. Obtener detalles de primer gabinete
  const cabinetId = cabinets.data.list[0].cabinet_id;
  const details = await fetch(`/api/v1/wscharge/cabinets/${cabinetId}/details`).then(r => r.json());

  // 3. Obtener lista de baterías
  const batteries = await fetch('/api/v1/wscharge/batteries').then(r => r.json());

  return { cabinets, details, batteries };
}

// Funciona sin ningún login previo!
```

### Ejemplo 3: Manejo de errores

```typescript
try {
  const response = await fetch('/api/v1/wscharge/cabinets');
  const data = await response.json();

  if (!data.success) {
    console.error('Error:', data.error);
  } else {
    console.log('Gabinetes:', data.data);
  }
} catch (error) {
  console.error('Error de red:', error);
}
```

## Debugging

### Ver el estado de autenticación en los logs

```bash
# Buscar en los logs del servidor
grep "WsCharge" logs/combined.log

# Verás algo como:
[info]: WsCharge API Service initialized
[info]: Initializing WsCharge API service with auto-login
[info]: Attempting to login to WsCharge API {"name":"tu_usuario"}
[info]: Successfully logged in to WsCharge API {"ocode":"test","tokenExpiresAt":"2024-12-17T15:30:00.000Z"}
```

### Verificar que las credenciales están configuradas

```bash
# En el servidor, verifica las variables
echo $WSCHARGE_OCODE
echo $WSCHARGE_USERNAME
# NO imprimas WSCHARGE_PASSWORD por seguridad
```

### Probar el endpoint de status

```bash
curl http://localhost:3000/api/v1/wscharge/auth/status

# Deberías ver:
{
  "success": true,
  "data": {
    "authenticated": true
  }
}
```

## Flujo Completo de Autenticación

```
┌─────────────────────────────────────────────────────────────┐
│                    INICIO DEL SERVIDOR                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  WsChargeApiService Constructor                              │
│  • Lee WSCHARGE_OCODE del .env                              │
│  • Configura Axios con interceptors                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  wsChargeApiService.initialize()                            │
│  • Lee WSCHARGE_USERNAME y WSCHARGE_PASSWORD                │
│  • Hace login automático                                    │
│  • Guarda token (30 min validez)                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              SERVIDOR LISTO PARA USAR                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               REQUEST DEL CLIENTE                            │
│  GET /api/v1/wscharge/cabinets                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  WsChargeApiService.getCabinetList()                        │
│  1. Llama ensureAuthenticated()                             │
│     ├─ ¿Token válido? SI → Continuar                       │
│     └─ ¿Token válido? NO → Auto-login                      │
│  2. Hace request con token válido                          │
│  3. Axios interceptor agrega headers:                       │
│     • ocode: del .env                                       │
│     • token: del login                                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│         REQUEST A WSCHARGE API                               │
│  POST https://api.w-dian.cn/operate/equipment/index         │
│  Headers:                                                    │
│    ocode: test                                              │
│    token: TAMbPx9ytF                                        │
│    Content-Type: application/x-www-form-urlencoded          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              RESPUESTA AL CLIENTE                            │
│  {                                                           │
│    "success": true,                                         │
│    "data": { ... }                                          │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

## Seguridad

### ✅ Buenas Prácticas

1. **Nunca commites el archivo `.env`**:
   ```bash
   # Asegúrate que .env está en .gitignore
   echo ".env" >> .gitignore
   ```

2. **Usa variables de entorno en producción**:
   ```bash
   # En tu servidor de producción
   export WSCHARGE_OCODE="production_code"
   export WSCHARGE_USERNAME="prod_user"
   export WSCHARGE_PASSWORD="secure_password"
   ```

3. **Rota las contraseñas regularmente**:
   - Cambia las credenciales cada cierto tiempo
   - Actualiza el `.env` y reinicia el servidor

### ❌ Errores Comunes

1. **"Not authenticated" error**:
   ```
   Error: Not authenticated. Please provide WSCHARGE_USERNAME and WSCHARGE_PASSWORD
   ```
   **Solución**: Verifica que las variables estén en el `.env`

2. **"请输入正确的运营商标识符"** (Operator code incorrecto):
   ```
   Error: 请输入正确的运营商标识符
   ```
   **Solución**: Verifica que `WSCHARGE_OCODE` esté correctamente configurado

3. **"Login failed"**:
   ```
   Error: Login failed
   ```
   **Solución**: Verifica username y password

## Migración desde el Sistema Anterior

Si estabas usando el login manual:

### ANTES:
```typescript
// 1. Login manual en tu código
const loginResponse = await fetch('/api/v1/wscharge/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'user', password: 'pass' })
});

// 2. Guardar token (si lo hacías)
const { token } = await loginResponse.json();

// 3. Usar en otros requests (si lo hacías)
const cabinets = await fetch('/api/v1/wscharge/cabinets', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### AHORA:
```typescript
// 1. Configurar .env UNA VEZ
// WSCHARGE_OCODE=test
// WSCHARGE_USERNAME=user
// WSCHARGE_PASSWORD=pass

// 2. Usar directamente cualquier endpoint
const cabinets = await fetch('/api/v1/wscharge/cabinets');

// ¡Eso es todo! No necesitas login manual ni manejar tokens
```

## Preguntas Frecuentes

### ¿Necesito llamar al endpoint de login?
**No**, es completamente automático si las credenciales están en el `.env`.

### ¿Qué pasa si el token expira?
Se renueva automáticamente antes del siguiente request.

### ¿Puedo usar diferentes credenciales para diferentes requests?
Sí, puedes llamar al endpoint de login manual con otras credenciales, pero solo afectará a esa sesión.

### ¿Qué pasa si cambio las credenciales en el .env?
Necesitas reiniciar el servidor para que tome las nuevas credenciales.

### ¿Es seguro?
Sí, las credenciales solo están en el servidor (nunca se envían al frontend) y se usan internamente para autenticación con WsCharge API.

## Resumen

✅ **Configura una vez**: Agrega las variables al `.env`
✅ **Olvídate del login**: Todo es automático
✅ **Usa los endpoints**: Directamente sin autenticación manual
✅ **Transparente**: Los tokens se renuevan automáticamente
✅ **Seguro**: Las credenciales nunca salen del servidor

El endpoint `/api/v1/wscharge/auth/login` sigue disponible para casos especiales, pero **ya no es necesario para uso normal**.
