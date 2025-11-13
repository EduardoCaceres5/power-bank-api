# Pagopar - Integración de Pagos

## Documentación de Referencia

URL Original: https://soporte.pagopar.com/portal/es/kb/articles/catastro-tarjetas-pagos-recurrentes-preautorizacion

## Información General

Pagopar es la pasarela de pagos líder en Paraguay que permite procesar pagos con:
- Tarjetas de crédito/débito (Mastercard, VISA)
- Billeteras electrónicas (Tigo Money, Personal, Zimple, Wally)
- Puntos de pago en efectivo (Aqui Pago, Pago Express, Wepa)
- Transferencias bancarias
- PIX (para usuarios de Brasil)

---

## Catastro de Tarjetas

El catastro de tarjetas permite registrar y almacenar de forma segura los datos de las tarjetas de los clientes para realizar cobros automáticos o pagos recurrentes.

### Beneficios:
- Cobros automáticos mensuales
- Mejor experiencia de usuario (un solo clic)
- Cumplimiento PCI-DSS
- Reducción de fricción en el checkout

### Flujo de Catastro:
1. Cliente ingresa datos de tarjeta
2. Pagopar valida y registra la tarjeta
3. Se genera un token único para la tarjeta
4. Token se usa para futuros cobros sin re-ingresar datos

---

## Pagos Recurrentes

Los pagos recurrentes permiten cobrar automáticamente a los clientes en intervalos regulares (mensual, trimestral, anual).

### Características:
- Cobros automáticos programados
- Soporte para suscripciones
- Notificaciones automáticas
- Gestión de renovaciones

### Casos de Uso:
- Suscripciones mensuales
- Alquiler de equipos
- Servicios recurrentes
- Membresías

---

## Preautorización

La preautorización permite reservar fondos en la tarjeta del cliente sin realizar el cobro inmediato.

### Flujo de Preautorización:
1. Se reserva el monto en la tarjeta
2. El monto queda bloqueado pero no cobrado
3. Posteriormente se puede:
   - Confirmar el cobro (capture)
   - Cancelar la reserva (void)
   - Ajustar el monto (partial capture)

### Casos de Uso:
- Alquiler de power banks (reserva + cobro al devolver)
- Hoteles (reserva de habitación)
- Alquiler de vehículos
- Servicios con costo variable

---

## Integración API

### Autenticación

**API Keys requeridas:**
- `public_key`: Para frontend (públicamente visible)
- `private_key`: Para backend (confidencial)
- `token`: Token de comercio

### Ambientes

**Sandbox (Pruebas):**
```
URL Base: https://api.pagopar.com/sandbox
```

**Producción:**
```
URL Base: https://api.pagopar.com/v1
```

---

## Endpoints Principales

### 1. Crear Transacción Simple

```http
POST /api/v1/transactions
Content-Type: application/json
Authorization: Bearer {private_key}

{
  "public_key": "tu_public_key",
  "operation": {
    "token": "tu_token_comercio",
    "amount": "100000",
    "currency": "PYG",
    "description": "Alquiler de Power Bank",
    "additional_data": "Order #12345"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "transaction_id": "TRX123456",
    "process_id": "PROC789",
    "checkout_url": "https://checkout.pagopar.com/process/PROC789"
  }
}
```

---

### 2. Catastro de Tarjeta

```http
POST /api/v1/cards/register
Content-Type: application/json
Authorization: Bearer {private_key}

{
  "public_key": "tu_public_key",
  "token": "tu_token_comercio",
  "card": {
    "holder_name": "Juan Perez",
    "number": "4111111111111111",
    "expiry_month": "12",
    "expiry_year": "2025",
    "cvv": "123"
  },
  "customer": {
    "email": "juan@example.com",
    "name": "Juan Perez"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "card_token": "card_token_abc123",
    "last_four": "1111",
    "brand": "visa",
    "expiry": "12/2025"
  }
}
```

---

### 3. Crear Pago Recurrente

```http
POST /api/v1/subscriptions
Content-Type: application/json
Authorization: Bearer {private_key}

{
  "public_key": "tu_public_key",
  "token": "tu_token_comercio",
  "card_token": "card_token_abc123",
  "amount": "50000",
  "currency": "PYG",
  "frequency": "monthly",
  "description": "Suscripción mensual",
  "start_date": "2025-02-01"
}
```

---

### 4. Crear Preautorización

```http
POST /api/v1/preauth
Content-Type: application/json
Authorization: Bearer {private_key}

{
  "public_key": "tu_public_key",
  "token": "tu_token_comercio",
  "amount": "100000",
  "currency": "PYG",
  "card_token": "card_token_abc123",
  "description": "Reserva de power bank"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "preauth_id": "PREAUTH123",
    "amount": "100000",
    "status": "approved",
    "expires_at": "2025-01-20T23:59:59Z"
  }
}
```

---

### 5. Capturar Preautorización

```http
POST /api/v1/preauth/{preauth_id}/capture
Content-Type: application/json
Authorization: Bearer {private_key}

{
  "amount": "75000"  // Opcional: monto menor al preautorizado
}
```

---

### 6. Cancelar Preautorización

```http
POST /api/v1/preauth/{preauth_id}/void
Content-Type: application/json
Authorization: Bearer {private_key}
```

---

## Webhooks

Pagopar envía notificaciones POST a tu servidor cuando ocurren eventos importantes.

### Configuración:
1. Configurar URL de webhook en el panel de Pagopar
2. Implementar endpoint en tu servidor
3. Validar firma de webhook

### Endpoint de Webhook:
```http
POST /tu-servidor/webhooks/pagopar
Content-Type: application/json
X-Pagopar-Signature: {signature}

{
  "event": "transaction.approved",
  "transaction_id": "TRX123456",
  "amount": "100000",
  "status": "approved",
  "timestamp": "2025-01-13T10:30:00Z"
}
```

### Eventos Disponibles:
- `transaction.approved` - Transacción aprobada
- `transaction.rejected` - Transacción rechazada
- `transaction.cancelled` - Transacción cancelada
- `preauth.approved` - Preautorización aprobada
- `preauth.captured` - Preautorización capturada
- `preauth.voided` - Preautorización cancelada
- `subscription.created` - Suscripción creada
- `subscription.payment_success` - Pago recurrente exitoso
- `subscription.payment_failed` - Pago recurrente fallido

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 400 | Bad Request - Parámetros inválidos |
| 401 | Unauthorized - API key inválida |
| 402 | Payment Required - Fondos insuficientes |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no encontrado |
| 409 | Conflict - Transacción duplicada |
| 422 | Unprocessable Entity - Error de validación |
| 500 | Internal Server Error |

---

## Tarjetas de Prueba (Sandbox)

### Visa:
- **Aprobada:** 4111111111111111
- **Rechazada:** 4000000000000002
- **Fondos insuficientes:** 4000000000009995

### Mastercard:
- **Aprobada:** 5500000000000004
- **Rechazada:** 5105105105105100

**CVV:** Cualquier 3 dígitos (ej: 123)
**Fecha expiración:** Cualquier fecha futura

---

## Monedas Soportadas

- **PYG** - Guaraníes Paraguayos (principal)
- **USD** - Dólares Estadounidenses
- **BRL** - Reales Brasileños

---

## Implementación para Power Bank App

### Flujo Recomendado:

1. **Al Alquilar:**
   - Crear preautorización por monto base (ej: 50,000 PYG)
   - Reservar fondos en tarjeta del usuario
   - Guardar `preauth_id` en base de datos

2. **Al Devolver:**
   - Calcular monto real (base + cargos adicionales)
   - Capturar preautorización con monto calculado
   - Si monto > preautorizado: cobrar diferencia por separado

3. **Si se pierde:**
   - Capturar preautorización completa
   - Cobrar cargo adicional por pérdida

### Ventajas de Preautorización:
- Cliente no paga hasta devolver
- Garantía de fondos disponibles
- Flexibilidad en monto final
- Mejor experiencia de usuario

---

## Variables de Entorno Requeridas

```env
# Pagopar Configuration
PAGOPAR_PUBLIC_KEY=your_public_key
PAGOPAR_PRIVATE_KEY=your_private_key
PAGOPAR_MERCHANT_TOKEN=your_merchant_token
PAGOPAR_ENVIRONMENT=sandbox  # o 'production'
PAGOPAR_WEBHOOK_SECRET=your_webhook_secret

# URLs
PAGOPAR_API_URL=https://api.pagopar.com/v1
PAGOPAR_SANDBOX_URL=https://api.pagopar.com/sandbox
```

---

## Próximos Pasos

1. ✅ Obtener credenciales de Pagopar (sandbox y producción)
2. ⬜ Implementar servicio de Pagopar en backend
3. ⬜ Configurar webhooks
4. ⬜ Probar flujo completo en sandbox
5. ⬜ Integrar con sistema de rentals existente
6. ⬜ Testing exhaustivo
7. ⬜ Migrar a producción

---

## Recursos Adicionales

- Portal de Soporte: https://soporte.pagopar.com
- Dashboard: https://dashboard.pagopar.com
- Documentación API: https://soporte.pagopar.com/portal/es/kb/articles/api-integracion-medios-pagos

---

## Notas Importantes

⚠️ **Seguridad:**
- NUNCA exponer `private_key` en frontend
- Siempre validar webhooks con firma
- Usar HTTPS en producción
- Implementar rate limiting

⚠️ **Compliance:**
- Cumplir con normativas PCI-DSS
- No almacenar datos completos de tarjetas
- Usar tokens para referencias futuras

⚠️ **Testing:**
- Probar todos los casos: aprobado, rechazado, error
- Validar manejo de timeouts
- Probar webhooks localmente (usar ngrok)

---

**Última actualización:** 2025-01-13
**Versión:** 1.0
**Estado:** Draft - Pendiente de validación con documentación oficial
