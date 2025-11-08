# Guía de Integración de Dispositivos - Power Bank API

Esta guía explica cómo integrar dispositivos físicos (gabinetes) con la API para mantenerlos online y sincronizados.

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Requisitos](#requisitos)
3. [Configuración Inicial](#configuración-inicial)
4. [Flujo de Autenticación](#flujo-de-autenticación)
5. [Envío de Heartbeats](#envío-de-heartbeats)
6. [Monitoreo y Detección Offline](#monitoreo-y-detección-offline)
7. [Script de Prueba](#script-de-prueba)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Introducción

El sistema de Power Bank API incluye un mecanismo completo de autenticación y heartbeat para dispositivos físicos. Esto permite:

- **Autenticación segura** de dispositivos mediante tokens JWT
- **Sincronización en tiempo real** del estado de slots y power banks
- **Detección automática** de dispositivos offline
- **Recuperación automática** cuando un dispositivo vuelve a enviar heartbeats

## 📦 Requisitos

### Para el Servidor

- Node.js 18+
- PostgreSQL (vía Supabase)
- Variables de entorno configuradas

### Para el Dispositivo

- Capacidad de hacer requests HTTP/HTTPS
- Almacenamiento persistente para deviceId y deviceSecret
- Timer/cron para enviar heartbeats periódicos (cada 30-60 segundos)

---

## ⚙️ Configuración Inicial

### 1. Aplicar Migración de Base de Datos

Si la base de datos está disponible, aplica la migración:

```bash
pnpm prisma migrate dev --name add_device_auth_fields
```

Si no está disponible, la migración se aplicará cuando la base de datos esté accesible.

### 2. Configurar Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```env
# Configuración de Heartbeat
HEARTBEAT_TIMEOUT_MINUTES=5          # Tiempo sin heartbeat antes de marcar offline
CABINET_CHECK_INTERVAL_MINUTES=2     # Intervalo de verificación automática
DEVICE_JWT_EXPIRES_IN=24h            # Duración del token JWT para dispositivos

# Para testing (opcional)
TEST_DEVICE_ID=test-device-001
TEST_DEVICE_SECRET=test-secret-key-123456789
```

### 3. Crear un Gabinete

Si aún no tienes un gabinete creado, créalo primero:

```bash
curl -X POST http://localhost:3000/api/v1/cabinets \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "WSTD088888888888",
    "name": "Test Cabinet",
    "location": "Test Location",
    "address": "123 Test St",
    "latitude": 40.7128,
    "longitude": -74.0060
  }'
```

### 4. Registrar el Dispositivo

Como administrador, registra el dispositivo para el gabinete:

```bash
curl -X POST http://localhost:3000/api/v1/device/auth/register \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cabinetId": "WSTD088888888888",
    "deviceId": "my-device-001",
    "deviceSecret": "super-secret-device-key-12345"
  }'
```

**Importante:**
- El `deviceSecret` debe tener **mínimo 16 caracteres**
- Guarda el `deviceId` y `deviceSecret` de forma segura en el dispositivo
- El secret se almacena hasheado en la base de datos

---

## 🔐 Flujo de Autenticación

### 1. Login del Dispositivo

El dispositivo debe autenticarse para obtener un token JWT:

**Endpoint:** `POST /api/v1/device/auth/login`

**Request:**
```json
{
  "deviceId": "my-device-001",
  "deviceSecret": "super-secret-device-key-12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "cabinetId": "WSTD088888888888",
    "expiresIn": 86400
  }
}
```

### 2. Usar el Token

El token debe incluirse en todas las requests posteriores:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Renovar el Token

Los tokens expiran después de 24 horas (configurable). El dispositivo debe:

1. Monitorear el tiempo de expiración
2. Renovar el token antes de que expire (hacer login nuevamente)
3. Actualizar el token almacenado

---

## 💓 Envío de Heartbeats

### Frecuencia Recomendada

- **Producción:** Cada 30-60 segundos
- **Testing:** Cada 10-30 segundos
- **Minimum:** No menos de 5 minutos (para evitar ser marcado como offline)

### Estructura del Heartbeat

**Endpoint:** `POST /api/v1/device/heartbeat`

**Headers:**
```
Authorization: Bearer <device_token>
Content-Type: application/json
```

**Body:**
```json
{
  "status": "ONLINE",
  "signalStrength": 25,
  "ipAddress": "192.168.1.100",
  "connectionType": "wifi",
  "slots": [
    {
      "slotNumber": 1,
      "isOccupied": true,
      "powerBankId": "WSBA00000001",
      "batteryLevel": 85
    },
    {
      "slotNumber": 2,
      "isOccupied": false
    }
  ]
}
```

**Campos:**

- `status` (opcional): Estado del gabinete (`ONLINE`, `OFFLINE`, `MAINTENANCE`, `OUT_OF_SERVICE`)
- `signalStrength` (opcional): Fuerza de señal (1-31)
- `ipAddress` (opcional): IP actual del dispositivo
- `connectionType` (opcional): Tipo de conexión (`wifi`, `ethernet`, `4g`)
- `slots` (opcional): Array con el estado de cada slot

**Response:**
```json
{
  "success": true,
  "message": "Heartbeat received",
  "data": {
    "cabinetId": "WSTD088888888888",
    "status": "ONLINE",
    "lastPingAt": "2025-01-15T10:30:00Z",
    "slotsUpdated": 2
  }
}
```

### Qué Hace el Servidor con el Heartbeat

1. **Actualiza `lastPingAt`**: Marca la hora del último heartbeat
2. **Cambia status a ONLINE**: Si estaba offline, lo marca como online automáticamente
3. **Crea/Actualiza slots**: Los slots se crean si no existen
4. **Sincroniza power banks**: Actualiza battery level y status de cada power bank
5. **Registra IP y conexión**: Guarda la última IP y tipo de conexión conocidos

---

## 🤖 Monitoreo y Detección Offline

### Servicio Automático

El servidor incluye un cron job que:

- **Se ejecuta cada 2 minutos** (configurable con `CABINET_CHECK_INTERVAL_MINUTES`)
- **Busca gabinetes** que no han enviado heartbeat en los últimos 5 minutos (configurable con `HEARTBEAT_TIMEOUT_MINUTES`)
- **Marca como OFFLINE** automáticamente los gabinetes que cumplan la condición
- **Registra en logs** todos los cambios de estado

### Configuración

```env
# Tiempo sin heartbeat antes de marcar como offline (default: 5 minutos)
HEARTBEAT_TIMEOUT_MINUTES=5

# Intervalo de verificación (default: 2 minutos)
CABINET_CHECK_INTERVAL_MINUTES=2
```

### Recuperación Automática

Cuando un gabinete OFFLINE vuelve a enviar un heartbeat:

1. Se marca automáticamente como `ONLINE`
2. Se actualiza `lastPingAt`
3. Se registra en los logs

---

## 🧪 Script de Prueba

### Ejecutar el Simulador

Incluimos un script para simular un dispositivo:

```bash
pnpm test:device
```

### Lo que hace el simulador:

1. ✅ Se autentica con el servidor
2. ✅ Obtiene el estado actual del gabinete
3. ✅ Envía heartbeats cada 30 segundos
4. ✅ Simula 8 slots con 3 power banks cargando
5. ✅ Incrementa el nivel de batería en cada heartbeat
6. ✅ Muestra el estado en consola

### Configurar el Simulador

Edita las variables en `.env`:

```env
# API Base URL
API_BASE_URL=http://localhost:3000/api/v1

# Credenciales del dispositivo de prueba
TEST_DEVICE_ID=test-device-001
TEST_DEVICE_SECRET=test-secret-key-123456789
```

### Salida del Simulador

```
═══════════════════════════════════════════════════════
           Device Heartbeat Simulator
═══════════════════════════════════════════════════════

🔐 Authenticating device...
Device ID: test-device-001
✅ Authentication successful!
Cabinet ID: WSTD088888888888
Token expires in: 86400 seconds

📊 Fetching cabinet status from server...
✅ Status retrieved successfully
   Cabinet ID: WSTD088888888888
   Status: ONLINE
   Last Ping: 1/15/2025, 10:30:00 AM
   Signal Strength: 25
   Slots: 8

🚀 Starting device simulator...
📡 Sending heartbeat every 30 seconds
Press Ctrl+C to stop

💓 [10:30:15] Heartbeat sent successfully
   Status: ONLINE
   Slots updated: 8
   Slots:
      [1] 🔋 WSBA00000001 (48%)
      [2] 🔋 WSBA00000002 (82%)
      [3] 🔋 WSBA00000003 (100%)
      [4] ⚪ Empty
      [5] ⚪ Empty
      [6] ⚪ Empty
      [7] ⚪ Empty
      [8] ⚪ Empty
```

---

## 🔧 Troubleshooting

### El dispositivo no puede autenticarse

**Error:** `401 - Invalid device credentials`

**Soluciones:**
1. Verifica que el `deviceId` y `deviceSecret` sean correctos
2. Asegúrate de que el dispositivo esté registrado para el gabinete
3. Verifica que el `deviceSecret` tenga mínimo 16 caracteres

### El heartbeat falla con 401

**Error:** `401 - Invalid device token`

**Soluciones:**
1. El token expiró - vuelve a hacer login
2. El token es inválido - verifica que lo estés enviando correctamente en el header `Authorization`

### El gabinete se marca como offline constantemente

**Problema:** El gabinete aparece offline aunque esté enviando heartbeats

**Soluciones:**
1. Verifica que los heartbeats se envíen cada menos de 5 minutos
2. Aumenta `HEARTBEAT_TIMEOUT_MINUTES` si necesitas más tiempo
3. Revisa los logs del servidor para ver si los heartbeats están llegando

### Los slots no se actualizan

**Problema:** El servidor no refleja cambios en los slots

**Soluciones:**
1. Verifica que estés enviando el array `slots` en el heartbeat
2. Asegúrate de que `slotNumber` sea un número entre 1-8
3. Si usas `powerBankId`, asegúrate de que siga el formato correcto

---

## 📚 Recursos Adicionales

- [API_ENDPOINTS.md](./API_ENDPOINTS.md) - Documentación completa de la API
- [scripts/test-device-heartbeat.ts](./scripts/test-device-heartbeat.ts) - Código del simulador
- [src/services/deviceAuth.service.ts](./src/services/deviceAuth.service.ts) - Servicio de autenticación
- [src/services/cabinetMonitor.service.ts](./src/services/cabinetMonitor.service.ts) - Servicio de monitoreo

---

## 🤝 Soporte

Si tienes problemas con la integración:

1. Revisa los logs del servidor
2. Usa el script de prueba para verificar que el servidor funciona correctamente
3. Verifica la configuración de variables de entorno
4. Consulta la documentación de la API

---

## 📝 Ejemplo de Implementación (Pseudocódigo)

```javascript
class CabinetDevice {
  constructor(deviceId, deviceSecret) {
    this.deviceId = deviceId;
    this.deviceSecret = deviceSecret;
    this.token = null;
    this.cabinetId = null;
  }

  async authenticate() {
    const response = await fetch('/api/v1/device/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: this.deviceId,
        deviceSecret: this.deviceSecret
      })
    });

    const data = await response.json();
    this.token = data.data.token;
    this.cabinetId = data.data.cabinetId;
  }

  async sendHeartbeat() {
    // Obtener estado actual de slots del hardware
    const slots = this.readSlotsFromHardware();

    const response = await fetch('/api/v1/device/heartbeat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        status: 'ONLINE',
        signalStrength: this.getSignalStrength(),
        ipAddress: this.getIpAddress(),
        connectionType: 'wifi',
        slots: slots
      })
    });

    if (response.status === 401) {
      // Token expiró, re-autenticar
      await this.authenticate();
    }
  }

  startHeartbeat() {
    // Enviar heartbeat cada 30 segundos
    setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }
}

// Uso
const device = new CabinetDevice('my-device-001', 'secret-key');
await device.authenticate();
device.startHeartbeat();
```

---

¡Feliz integración! 🚀
