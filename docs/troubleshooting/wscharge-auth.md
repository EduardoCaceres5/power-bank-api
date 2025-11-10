# 🔧 Troubleshooting: WsCharge Authentication Error

## Problema

Al loguearse en la aplicación, aparece el error:
```
Error: 请先登录 (Please login first)
at WsChargeApiService.getBatteryList
at WsChargeApiService.getPlanList
```

## Causa Raíz

Este error ocurre porque el servicio WsCharge **no está autenticado** o el token ha expirado. El flujo de autenticación es:

1. ✅ Usuario se loguea en tu app → Autenticación con Supabase funciona
2. ❌ Usuario hace request a datos de WsCharge → **Servicio WsCharge no está autenticado**

### ¿Por qué pasa esto?

- El token de WsCharge expira después de **30 minutos**
- Si el servidor se reinicia, pierde la autenticación
- Las variables de entorno pueden no estar configuradas en producción (Railway)

---

## ✅ Solución Implementada

Se mejoraron los siguientes métodos en `wscharge-api.service.ts`:

### 1. `ensureAuthenticated()` mejorado
- Logs detallados de estado de autenticación
- Auto-login automático si las credenciales están en variables de entorno
- Manejo de errores mejorado

### 2. Logs agregados en:
- `getBatteryList()`
- `getCabinetList()`
- `getPlanList()`

### 3. Auto-retry en cada request
Ahora **cada request** verifica si está autenticado y hace auto-login si es necesario.

---

## 🔍 Verificar el Problema en Railway

### Paso 1: Verificar Variables de Entorno

Ve a tu proyecto en Railway → Settings → Variables y verifica que existan:

```env
WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=samuelcharge
WSCHARGE_USERNAME=admin
WSCHARGE_PASSWORD=111111
```

### Paso 2: Ver Logs en Tiempo Real

1. Abre Railway → Tu proyecto
2. Ve a **Deployments** → Click en el deploy activo
3. Busca estos logs:

**✅ Login exitoso:**
```
[info]: Attempting to login to WsCharge API {"name":"admin"}
[info]: Successfully logged in to WsCharge API {"ocode":"samuelcharge","tokenExpiresAt":"..."}
```

**❌ Login fallido:**
```
[error]: Login failed {"error":"..."}
[error]: Not authenticated and WsCharge credentials not found
```

### Paso 3: Verificar Estado de Autenticación

Busca en los logs cuando haces un request:

**✅ Estado correcto:**
```
[debug]: Checking authentication status {
  "isAuthenticated": true,
  "hasToken": true,
  "tokenExpiresAt": "2025-11-08T13:30:00.000Z"
}
[info]: Getting battery list {
  "params": {"page":1,"page_size":1},
  "authenticated": true,
  "hasToken": true
}
```

**❌ Estado incorrecto:**
```
[debug]: Checking authentication status {
  "isAuthenticated": false,
  "hasToken": false
}
[info]: Token expired or missing, attempting auto-login {"username":"admin"}
```

---

## 🚀 Soluciones

### Solución 1: Verificar Variables de Entorno en Railway

```bash
# Usando Railway CLI
railway variables

# Debería mostrar:
# WSCHARGE_API_URL=https://api.w-dian.cn/operate
# WSCHARGE_OCODE=samuelcharge
# WSCHARGE_USERNAME=admin
# WSCHARGE_PASSWORD=111111
```

Si no existen, agrégalas manualmente en Railway Dashboard:
1. Settings → Variables
2. Click en **+ New Variable**
3. Agrega cada una

### Solución 2: Redeploy Manual

Después de agregar las variables:
```bash
# Hacer un redeploy forzado
railway up --detach
```

O desde el dashboard:
1. Deployments → Click en "Deploy"

### Solución 3: Forzar Re-login

Si el servidor está corriendo pero no autenticado, reinicia el servicio:
```bash
# Desde Railway CLI
railway restart
```

O desde el dashboard:
1. Settings → Restart

---

## 🧪 Testing

### Test 1: Health Check
```bash
curl https://your-railway-url.up.railway.app/
```

**Esperado:**
```json
{
  "name": "Power Bank API",
  "version": "v1",
  "status": "running"
}
```

### Test 2: Verificar Autenticación WsCharge

Loguéate en tu app y luego haz un request a:
```bash
curl https://your-railway-url.up.railway.app/api/v1/wscharge/batteries?page=1&page_size=1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**✅ Respuesta correcta:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 10
  }
}
```

**❌ Respuesta incorrecta:**
```json
{
  "success": false,
  "error": "请先登录"
}
```

### Test 3: Ver Logs de Auto-login

Después de hacer el request anterior, revisa los logs en Railway. Deberías ver:

```
[debug]: Checking authentication status {"isAuthenticated":false,...}
[info]: Token expired or missing, attempting auto-login {"username":"admin"}
[info]: Attempting to login to WsCharge API {"name":"admin"}
[info]: Successfully logged in to WsCharge API {"ocode":"samuelcharge",...}
[info]: Auto-login successful {"hasToken":true,...}
[info]: Getting battery list {"params":{...},"authenticated":true,"hasToken":true}
[info]: Battery list retrieved successfully {"count":10}
```

---

## 📊 Monitoring

### Verificar Estado del Servicio

Agrega un endpoint de health check que incluya el estado de WsCharge:

```typescript
// En src/routes/health.routes.ts
app.get('/api/v1/health/wscharge', (req, res) => {
  const wsChargeService = require('../services/wscharge-api.service').wsChargeApiService;

  res.json({
    isAuthenticated: wsChargeService.isAuthenticated(),
    // No expongas el token por seguridad
  });
});
```

---

## 🔄 Flujo de Autenticación Corregido

### Antes (❌ Con Problema)
```
1. Usuario se loguea → ✅ Auth con Supabase
2. Request a /batteries → ❌ WsCharge no autenticado
3. Error: "请先登录"
```

### Ahora (✅ Funcionando)
```
1. Usuario se loguea → ✅ Auth con Supabase
2. Request a /batteries → 🔍 Verifica auth de WsCharge
3a. Si está autenticado → ✅ Retorna datos
3b. Si NO está autenticado:
    - 🔄 Auto-login con credenciales de .env
    - ✅ Retorna datos
```

---

## ⚙️ Configuración Recomendada

### Variables de Entorno Requeridas

**Producción (Railway):**
```env
# WsCharge API - REQUERIDO
WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=samuelcharge
WSCHARGE_USERNAME=admin
WSCHARGE_PASSWORD=111111

# Logs - Recomendado para debugging
LOG_LEVEL=debug
```

**Desarrollo (.env local):**
```env
# Las mismas variables
WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=samuelcharge
WSCHARGE_USERNAME=admin
WSCHARGE_PASSWORD=111111

LOG_LEVEL=debug
```

---

## 🚨 Errores Comunes

### Error: "Not authenticated and WsCharge credentials not found"

**Causa:** Variables de entorno no están configuradas

**Solución:**
1. Verifica que existan en Railway
2. Redeploy después de agregar variables
3. Reinicia el servicio

### Error: "Failed to authenticate with WsCharge API"

**Causa:** Credenciales incorrectas o API de WsCharge caída

**Solución:**
1. Verifica las credenciales (username/password)
2. Prueba hacer login manualmente:
   ```bash
   curl -X POST https://api.w-dian.cn/operate/auth/login \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "name=admin&password=111111"
   ```
3. Si falla, contacta soporte de WsCharge

### Error: "Token expired"

**Causa:** Token de WsCharge expiró (30 minutos)

**Solución:** El servicio ahora hace auto-login automáticamente. Si persiste:
1. Reinicia el servicio en Railway
2. Verifica los logs para ver si el auto-login funciona

---

## 📝 Checklist de Troubleshooting

- [ ] Variables de entorno configuradas en Railway
- [ ] Código actualizado con mejoras de autenticación
- [ ] Deploy realizado después de cambios
- [ ] Logs muestran "Auto-login successful"
- [ ] Requests a `/batteries` y `/plans` funcionan
- [ ] No hay errores "请先登录" en logs

---

## 🆘 Si Nada Funciona

1. **Limpia y redeploy:**
   ```bash
   git add .
   git commit -m "fix: WsCharge authentication improvements"
   git push
   ```

2. **Reinicia todos los servicios en Railway:**
   - Settings → Restart

3. **Verifica la API de WsCharge directamente:**
   ```bash
   # Test login directo
   curl -X POST https://api.w-dian.cn/operate/auth/login \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "ocode: samuelcharge" \
     -d "name=admin&password=111111"
   ```

4. **Contacta al equipo de WsCharge** si el login directo falla

---

¿Necesitas más ayuda? Revisa los logs en Railway o haz un request de prueba.
