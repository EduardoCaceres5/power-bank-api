# Rate Limiting Implementation

Este documento describe la implementación de rate limiting en las rutas de autenticación del backend.

## Descripción

Se ha implementado rate limiting usando el paquete `express-rate-limit` para proteger las rutas de autenticación contra:
- Ataques de fuerza bruta
- Spam de registros
- Abuso de endpoints de autenticación

## Configuración

### Rutas Protegidas

| Ruta | Límite | Ventana de Tiempo | Descripción |
|------|--------|------------------|-------------|
| `POST /api/v1/auth/login` | 5 intentos | 15 minutos | Login de usuarios |
| `POST /api/v1/auth/register` | 3 intentos | 1 hora | Registro de nuevos usuarios |
| `POST /api/v1/auth/verify` | 5 intentos | 15 minutos | Verificación de tokens |
| `POST /api/v1/auth/change-password` | 5 intentos | 1 hora | Cambio de contraseña |

### Middleware Disponible

#### `loginLimiter`
- **Límite**: 5 intentos por IP
- **Ventana**: 15 minutos
- **Características**: Solo cuenta intentos fallidos (`skipSuccessfulRequests: true`)
- **Uso**: Protección contra fuerza bruta en login

#### `registerLimiter`
- **Límite**: 3 intentos por IP
- **Ventana**: 1 hora
- **Características**: Cuenta todos los intentos
- **Uso**: Prevención de spam de cuentas

#### `authLimiter`
- **Límite**: 5 intentos por IP
- **Ventana**: 15 minutos
- **Características**: Limitador general para rutas de autenticación
- **Uso**: Verificación de tokens y otras operaciones de auth

#### `passwordChangeLimiter`
- **Límite**: 5 intentos por IP
- **Ventana**: 1 hora
- **Características**: Limita cambios de contraseña
- **Uso**: Prevención de abuso del endpoint de cambio de contraseña

## Headers de Respuesta

Cuando se aplica rate limiting, las respuestas incluyen los siguientes headers:

```
RateLimit-Limit: 5           # Número máximo de requests permitidos
RateLimit-Remaining: 3       # Requests restantes en la ventana actual
RateLimit-Reset: 1634567890  # Timestamp cuando se resetea el límite
```

## Respuesta cuando se excede el límite

Cuando se excede el límite, el servidor responde con:

**Status Code**: `429 Too Many Requests`

**Body**:
```json
{
  "success": false,
  "error": "Too many [operation] attempts. Please try again after [time]."
}
```

## Logging

Todos los casos en que se excede el rate limit son registrados en los logs con:
- IP del cliente
- Ruta afectada
- Email (cuando esté disponible en el body)
- Timestamp

## Pruebas

### Prueba Manual

1. Inicia el servidor:
   ```bash
   pnpm run dev
   ```

2. Ejecuta el script de prueba:
   ```bash
   node test-rate-limit.js
   ```

### Prueba con cURL

```bash
# Probar login (5 veces para ver rate limiting)
for i in {1..6}; do
  echo "Request $i:"
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n\n"
done
```

### Prueba con Postman/Insomnia

1. Crea una request POST a `http://localhost:3000/api/v1/auth/login`
2. Body:
   ```json
   {
     "email": "test@example.com",
     "password": "wrongpassword"
   }
   ```
3. Envía la request 6 veces rápidamente
4. La 6ta request debería retornar `429 Too Many Requests`

## Configuración Personalizada

Para ajustar los límites, edita el archivo [src/middleware/rateLimiter.middleware.ts](src/middleware/rateLimiter.middleware.ts):

```typescript
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ajustar ventana de tiempo
  max: 5,                    // Ajustar número máximo de requests
  // ... otras opciones
});
```

## Consideraciones

### Producción
- Los límites actuales son conservadores y apropiados para producción
- Considerar aumentar límites si hay falsos positivos
- Monitorear logs para detectar patrones de abuso

### Desarrollo
- Los límites también aplican en desarrollo
- Para deshabilitar temporalmente, comentar el middleware en las rutas
- El rate limiting se resetea al reiniciar el servidor

### Escalabilidad
- La implementación actual usa almacenamiento en memoria
- Para múltiples instancias del servidor, considerar usar Redis:
  ```typescript
  import RedisStore from 'rate-limit-redis';
  import { createClient } from 'redis';

  const client = createClient({ url: process.env.REDIS_URL });

  export const loginLimiter = rateLimit({
    store: new RedisStore({ client }),
    // ... resto de configuración
  });
  ```

## Archivos Modificados

- ✅ `src/middleware/rateLimiter.middleware.ts` - Nuevo archivo con middlewares
- ✅ `src/routes/auth.routes.ts` - Aplicación de rate limiting a rutas
- ✅ `test-rate-limit.js` - Script de prueba
- ✅ `package.json` - Dependencia `express-rate-limit` agregada

## Referencias

- [express-rate-limit Documentation](https://github.com/express-rate-limit/express-rate-limit)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html#rate-limiting)
