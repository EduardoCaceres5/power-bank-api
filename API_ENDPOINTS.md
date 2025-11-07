# API Endpoints - Cabinet Management

Esta documentación describe todos los endpoints disponibles para la gestión de gabinetes en el sistema.

## Base URL

```
http://localhost:3000/api/v1
```

## Autenticación

La mayoría de los endpoints de administración requieren autenticación mediante JWT Bearer token.

```
Authorization: Bearer <token>
```

### Roles de Usuario

- `USER`: Usuario regular
- `ADMIN`: Administrador
- `SUPER_ADMIN`: Super administrador

---

## 📦 Cabinet Endpoints

### Public Endpoints (No requieren autenticación)

#### GET `/cabinets`
Obtener todos los gabinetes online.

**Query Parameters:**
- `latitude` (opcional): Latitud para búsqueda cercana
- `longitude` (opcional): Longitud para búsqueda cercana
- `radius` (opcional): Radio de búsqueda en km

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "WSTD088888888888",
      "name": "Cabinet Downtown",
      "location": "Downtown",
      "address": "123 Main St",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "status": "ONLINE",
      "availableSlots": 5,
      "totalSlots": 8,
      "slots": [...]
    }
  ]
}
```

#### GET `/cabinets/nearby`
Buscar gabinetes cercanos con power banks disponibles.

**Query Parameters (Required):**
- `latitude`: Latitud actual
- `longitude`: Longitud actual
- `radius` (opcional): Radio de búsqueda en km (default: 5)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "WSTD088888888888",
      "name": "Cabinet Downtown",
      "distance": 2.5,
      "availablePowerBanks": 3,
      ...
    }
  ]
}
```

#### GET `/cabinets/:id`
Obtener detalles de un gabinete específico.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "WSTD088888888888",
    "name": "Cabinet Downtown",
    "slots": [
      {
        "slotNumber": 1,
        "powerBank": {
          "id": "WSBA01234567",
          "batteryLevel": 85,
          "status": "AVAILABLE"
        }
      }
    ],
    ...
  }
}
```

---

### Admin Endpoints (Requieren ADMIN o SUPER_ADMIN)

#### POST `/cabinets`
Crear un nuevo gabinete.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "id": "WSTD088888888888",
  "name": "New Cabinet",
  "description": "Cabinet description",
  "location": "Downtown",
  "address": "123 Main Street, City",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "iotCardNumber": "K123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "WSTD088888888888",
    "name": "New Cabinet",
    ...
  },
  "message": "Cabinet created successfully"
}
```

**Errors:**
- `400`: Validation error (invalid ID format, missing required fields)
- `409`: Cabinet already exists

---

#### PUT `/cabinets/:id`
Actualizar un gabinete existente.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "location": "New Location",
  "address": "New Address",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "status": "ONLINE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "WSTD088888888888",
    ...
  },
  "message": "Cabinet updated successfully"
}
```

**Errors:**
- `404`: Cabinet not found

---

#### DELETE `/cabinets/:id`
Eliminar un gabinete.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Cabinet deleted successfully"
}
```

**Errors:**
- `404`: Cabinet not found
- `409`: Cabinet has active rentals (cannot delete)

---

#### PATCH `/cabinets/:id/status`
Actualizar el estado de un gabinete.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "status": "MAINTENANCE"
}
```

**Possible Status Values:**
- `ONLINE`: Cabinet activo y funcionando
- `OFFLINE`: Cabinet desconectado
- `MAINTENANCE`: En mantenimiento
- `OUT_OF_SERVICE`: Fuera de servicio

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "WSTD088888888888",
    "status": "MAINTENANCE",
    ...
  },
  "message": "Cabinet status updated successfully"
}
```

---

#### GET `/cabinets/:id/stats`
Obtener estadísticas detalladas de un gabinete.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cabinet": { ... },
    "stats": {
      "totalSlots": 8,
      "availableSlots": 3,
      "occupiedSlots": 5,
      "totalPowerBanks": 5,
      "availablePowerBanks": 3,
      "rentedPowerBanks": 2,
      "chargingPowerBanks": 0,
      "maintenancePowerBanks": 0
    },
    "rentals": {
      "total": 150,
      "active": 2,
      "completed": 145,
      "overdue": 3
    },
    "revenue": {
      "total": 1250.50,
      "thisMonth": 350.00,
      "thisWeek": 75.00,
      "today": 15.00
    },
    "uptime": {
      "lastPingAt": "2025-01-15T10:30:00Z",
      "status": "ONLINE",
      "uptimePercentage": 98.5
    }
  }
}
```

---

#### POST `/cabinets/:id/sync`
Sincronizar gabinete con WsCharge API.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "cabinetId": "WSTD088888888888",
    "syncedAt": "2025-01-15T10:30:00Z",
    "changes": {
      "slotsAdded": 0,
      "slotsRemoved": 0,
      "powerBanksUpdated": 2
    }
  },
  "message": "Cabinet synced successfully"
}
```

---

#### GET `/cabinets/admin/list`
Obtener lista completa de gabinetes con filtros (Admin).

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `status` (opcional): ONLINE | OFFLINE | MAINTENANCE | OUT_OF_SERVICE
- `location` (opcional): Filtrar por ubicación
- `hasAvailableSlots` (opcional): true | false
- `search` (opcional): Buscar en name, description, address

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 25
}
```

---

## 📊 Admin Dashboard Endpoints

Todos estos endpoints requieren rol ADMIN o SUPER_ADMIN.

### GET `/admin/dashboard`
Obtener resumen general del dashboard.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cabinets": {
      "total": 50,
      "byStatus": {
        "online": 45,
        "offline": 2,
        "maintenance": 2,
        "outOfService": 1
      },
      "totalSlots": 400,
      "totalAvailableSlots": 250,
      "totalPowerBanks": 300,
      "totalAvailablePowerBanks": 200
    },
    "rentals": {
      "total": 5000,
      "active": 50,
      "completed": 4900,
      "overdue": 10,
      "today": 25
    },
    "revenue": {
      "total": 50000.00,
      "today": 250.00,
      "thisWeek": 1500.00,
      "thisMonth": 6000.00
    },
    "users": {
      "total": 1200,
      "active": 1150,
      "newToday": 5
    },
    "recentActivity": [...],
    "alerts": [
      {
        "type": "warning",
        "message": "2 cabinet(s) are offline",
        "count": 2,
        "timestamp": "2025-01-15T10:30:00Z"
      }
    ]
  }
}
```

---

### GET `/admin/cabinets/stats`
Obtener estadísticas de todos los gabinetes.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": { ... },
    "topCabinets": [
      {
        "cabinetId": "WSTD088888888888",
        "name": "Cabinet Downtown",
        "location": "Downtown",
        "revenue": 5000.00,
        "totalRentals": 500
      }
    ],
    "allCabinets": [...]
  }
}
```

---

### GET `/admin/rentals/stats`
Obtener estadísticas de rentas.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `period` (opcional): 7d | 30d | 90d | 1y (default: 30d)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 1000,
      "active": 20,
      "completed": 950,
      "overdue": 5,
      "lost": 2,
      "averageDurationHours": 12.5
    },
    "byDay": {
      "2025-01-01": 35,
      "2025-01-02": 42,
      ...
    },
    "topUsers": [
      {
        "userId": "user-id",
        "email": "user@example.com",
        "count": 15
      }
    ],
    "period": "30d"
  }
}
```

---

### GET `/admin/revenue/stats`
Obtener estadísticas de ingresos.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `period` (opcional): 7d | 30d | 90d | 1y (default: 30d)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 15000.00,
      "transactionCount": 500,
      "averageTransaction": 30.00
    },
    "byType": {
      "RENTAL": 12000.00,
      "LATE_FEE": 2000.00,
      "LOST_FEE": 1000.00
    },
    "byDay": {
      "2025-01-01": 500.00,
      "2025-01-02": 650.00,
      ...
    },
    "topCabinets": [
      {
        "cabinetId": "WSTD088888888888",
        "name": "Cabinet Downtown",
        "revenue": 5000.00
      }
    ],
    "period": "30d"
  }
}
```

---

### GET `/admin/alerts`
Obtener alertas del sistema.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "warning",
      "message": "2 cabinet(s) are offline",
      "count": 2,
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "type": "error",
      "message": "5 rental(s) are overdue",
      "count": 5,
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

## 🔒 Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation error",
  "details": [
    {
      "field": "latitude",
      "message": "Must be between -90 and 90"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "No authorization token provided"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Cabinet with ID WSTD088888888888 not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": "Cabinet with ID WSTD088888888888 already exists"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to create cabinet"
}
```

---

## 📝 Validation Rules

### Cabinet ID
- Format: `WSTD` + 12 digits
- Example: `WSTD088888888888`
- Regex: `/^WSTD\d{12}$/`

### Coordinates
- Latitude: -90 to 90
- Longitude: -180 to 180

### Search Radius
- Default: 5 km
- Maximum: 50 km

---

## 🚀 Quick Start Examples

### Crear un Gabinete

```bash
curl -X POST http://localhost:3000/api/v1/cabinets \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "WSTD088888888888",
    "name": "Test Cabinet",
    "location": "Downtown",
    "address": "123 Main St",
    "latitude": 40.7128,
    "longitude": -74.0060
  }'
```

### Buscar Gabinetes Cercanos

```bash
curl "http://localhost:3000/api/v1/cabinets/nearby?latitude=40.7128&longitude=-74.0060&radius=10"
```

### Obtener Dashboard

```bash
curl http://localhost:3000/api/v1/admin/dashboard \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Obtener Estadísticas de un Gabinete

```bash
curl http://localhost:3000/api/v1/cabinets/WSTD088888888888/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 📚 Notas Adicionales

1. **Sincronización con WsCharge**: Los gabinetes creados localmente se intentan registrar automáticamente en la API de WsCharge.

2. **Validación de Datos**: Todos los endpoints validan datos usando Zod schemas antes de procesarlos.

3. **Logging**: Todas las operaciones de administración se registran en los logs del sistema.

4. **Cascada de Eliminación**: Al eliminar un gabinete, se eliminan automáticamente sus slots relacionados.

5. **Prevención de Eliminación**: No se puede eliminar un gabinete que tenga rentas activas.

6. **Cálculo de Distancias**: Se usa la fórmula de Haversine para calcular distancias entre coordenadas.

7. **Uptime**: El cálculo de uptime es simplificado, basado en el último ping y estado actual.
