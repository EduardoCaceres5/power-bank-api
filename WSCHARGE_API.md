# WsCharge API Integration

This document describes the WsCharge HTTP API integration for power bank cabinet management.

## Overview

The WsCharge API provides HTTP endpoints to control and manage power bank cabinets. This is **separate** from the WebSocket protocol used for real-time cabinet communication.

- **Base URL**: `https://api.w-dian.cn/operate`
- **Protocol**: HTTP/HTTPS
- **Request Format**: `form-data`
- **Response Format**: JSON
- **API Version**: v1.0.0 (2024-08-23)

## Architecture

### Service Layer
- **`wscharge-api.service.ts`**: Main service class that handles all HTTP communication with WsCharge API
  - Token management with auto-renewal
  - Request/response interceptors
  - Error handling
  - All API endpoints implementation

### Controller Layer
- **`wscharge-api.controller.ts`**: REST API controllers that expose WsCharge functionality
  - Input validation
  - Error handling
  - Response formatting

### Types
- **`wscharge-api.types.ts`**: TypeScript interfaces for all API requests/responses

## Authentication

### Token Management

The WsCharge API uses token-based authentication:
- **Token validity**: 30 minutes
- **Auto-renewal**: Service automatically re-authenticates when token expires
- **Headers required**:
  - `ocode`: Operator identifier
  - `token`: Authentication token

### Login Endpoint

```http
POST /api/v1/wscharge/auth/login
Content-Type: application/json

{
  "name": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "TAMbPx9ytF",
    "ocode": "test",
    "equipment_model": [
      {
        "id": "zs4",
        "name": "Desktop 4-slot Cabinet",
        "producer": "zd",
        "num": 4
      }
    ]
  }
}
```

## Environment Configuration

Add these variables to your `.env` file:

```env
# WsCharge API Configuration
WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_USERNAME=your_username
WSCHARGE_PASSWORD=your_password
```

## API Endpoints

### 1. Device Management

#### Add Cabinet
```http
POST /api/v1/wscharge/cabinets
Content-Type: application/json

{
  "cabinet_id": "CT123456789",
  "qrcode": "QR123456",
  "model": "pm8",
  "sim": "1234567890" // Optional
}
```

#### Get Cabinet List
```http
GET /api/v1/wscharge/cabinets?page=1&page_size=20&is_online=1
```

#### Get Cabinet Info
```http
GET /api/v1/wscharge/cabinets/CT123456789
```

#### Update Cabinet
```http
PUT /api/v1/wscharge/cabinets/CT123456789
Content-Type: application/json

{
  "qrcode": "QR123456",
  "model": "pm8",
  "sim": "1234567890"
}
```

#### Delete Cabinet
```http
DELETE /api/v1/wscharge/cabinets/CT123456789
```

#### Get Battery List
```http
GET /api/v1/wscharge/batteries?page=1&page_size=20
```

### 2. Device Operations

#### Issue Command to Cabinet
```http
POST /api/v1/wscharge/cabinets/CT123456789/command
Content-Type: application/json

{
  "type": "borrow",        // Options: restart, borrow, open, openAll
  "lock_id": 1,            // Required for: borrow, open
  "order_no": "ORD123"     // Required for: borrow
}
```

**Command Types:**
- `restart`: Restart the cabinet device
- `borrow`: Rent a power bank from specific slot
- `open`: Open/eject a specific slot
- `openAll`: Open all slots

#### Get Cabinet Details
Get real-time power bank information in cabinet:
```http
GET /api/v1/wscharge/cabinets/CT123456789/details
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cabinet_id": "CT054200601018",
    "is_online": 1,
    "signal": 7,
    "device": [
      {
        "bid": "LC2405010004",
        "power": 100,
        "lock": 1,
        "quick_charge": 0
      },
      {
        "bid": "",
        "power": "",
        "lock": 2,
        "quick_charge": 0
      }
    ]
  }
}
```

### 3. Screen Management - AD Materials

#### Add Material
```http
POST /api/v1/wscharge/screen/materials
Content-Type: application/json

{
  "name": "Summer Campaign",
  "path": "https://example.com/image.jpg",
  "type": "image"  // Options: image, video
}
```

#### Get Material List
```http
GET /api/v1/wscharge/screen/materials?page=1&type=image
```

#### Delete Material
```http
DELETE /api/v1/wscharge/screen/materials/1
```

### 4. Screen Management - AD Groups

#### Add Group
```http
POST /api/v1/wscharge/screen/groups
Content-Type: application/json

{
  "name": "Group 1",
  "details": [
    {
      "material_id": 1,
      "sort": 1,
      "time": 5  // Display time in seconds
    },
    {
      "material_id": 2,
      "sort": 2,
      "time": 10
    }
  ]
}
```

#### Get Group List
```http
GET /api/v1/wscharge/screen/groups?page=1
```

#### Get Group Detail
```http
GET /api/v1/wscharge/screen/groups/1
```

#### Update Group
```http
PUT /api/v1/wscharge/screen/groups/1
Content-Type: application/json

{
  "name": "Updated Group",
  "details": [...]
}
```

#### Delete Group
```http
DELETE /api/v1/wscharge/screen/groups/1
```

### 5. Screen Management - AD Plans

#### Add Plan
```http
POST /api/v1/wscharge/screen/plans
Content-Type: application/json

{
  "plan_name": "Summer Campaign 2024",
  "start_date": "2024-06-01",
  "end_date": "2024-08-31",
  "details": [
    {
      "start_hour": 0,
      "start_minute": 0,
      "end_hour": 12,
      "end_minute": 0,
      "group_id": 1
    },
    {
      "start_hour": 12,
      "start_minute": 0,
      "end_hour": 23,
      "end_minute": 59,
      "group_id": 2
    }
  ],
  "equipment_group": "CT123456,CT789012"  // Comma-separated cabinet IDs
}
```

#### Get Plan List
```http
GET /api/v1/wscharge/screen/plans?page=1
```

#### Get Plan Detail
```http
GET /api/v1/wscharge/screen/plans/1
```

#### Update Plan
```http
PUT /api/v1/wscharge/screen/plans/1
Content-Type: application/json

{
  "plan_name": "Updated Campaign",
  "start_date": "2024-06-01",
  "end_date": "2024-08-31",
  "details": [...],
  "equipment_group": "CT123456,CT789012"
}
```

#### Delete Plan
```http
DELETE /api/v1/wscharge/screen/plans/1
```

### 6. System Settings

#### Get System Configuration
```http
GET /api/v1/wscharge/settings/battery_power
```

**Configuration Types:**
- `battery_power`: Minimum battery level for rental
- `screen_default`: Default screen images
- `webhook`: Power bank return webhook URL
- `qrcode_color`: QR code background color

#### Set System Configuration
```http
POST /api/v1/wscharge/settings
Content-Type: application/json

{
  "type": "battery_power",
  "battery_power": 80
}
```

**Example: Set Screen Default Images**
```http
POST /api/v1/wscharge/settings
Content-Type: application/json

{
  "type": "screen_default",
  "default_vertical": "https://example.com/default.jpg",
  "default_bottom": "https://example.com/bottom.jpg",
  "rent_success_vertical": "https://example.com/success.jpg",
  "rent_fail_vertical": "https://example.com/fail.jpg",
  "back_success_vertical": "https://example.com/return_success.jpg",
  "back_fail_vertical": "https://example.com/return_fail.jpg",
  "default_cross": "https://example.com/cross.jpg",
  "default_left_cross": "https://example.com/left_cross.jpg"
}
```

## Error Handling

### Response Structure

All API responses follow this structure:

```json
{
  "success": true/false,
  "data": { ... },      // Present on success
  "error": "...",       // Present on error
  "message": "..."      // Optional message
}
```

### WsCharge API Status Codes

- `1`: Success
- `0`: Failed
- `401`: Token expired, re-login required

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

## Usage Example

### TypeScript/Node.js

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1/wscharge';

// 1. Login
const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
  name: 'your_username',
  password: 'your_password'
});

// 2. Get Cabinet List
const cabinets = await axios.get(`${API_BASE}/cabinets?page=1`);

// 3. Get Cabinet Details
const details = await axios.get(`${API_BASE}/cabinets/CT123456789/details`);

// 4. Rent Power Bank
const rentResult = await axios.post(`${API_BASE}/cabinets/CT123456789/command`, {
  type: 'borrow',
  lock_id: 1,
  order_no: 'ORD123456'
});

console.log('Battery ID:', rentResult.data.data.battery_id);
console.log('Lock ID:', rentResult.data.data.lock_id);
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:3000/api/v1/wscharge/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"username","password":"password"}'

# Get Cabinet List
curl -X GET "http://localhost:3000/api/v1/wscharge/cabinets?page=1&page_size=20"

# Rent Power Bank
curl -X POST http://localhost:3000/api/v1/wscharge/cabinets/CT123456789/command \
  -H "Content-Type: application/json" \
  -d '{"type":"borrow","lock_id":1,"order_no":"ORD123"}'

# Get Cabinet Details
curl -X GET http://localhost:3000/api/v1/wscharge/cabinets/CT123456789/details
```

## Testing

### Manual Testing with Postman/Insomnia

1. Import the API endpoints
2. Set up environment variables:
   - `BASE_URL`: `http://localhost:3000/api/v1/wscharge`
3. Start with login endpoint
4. Test other endpoints

### Automated Testing

```bash
npm test -- wscharge-api
```

## Notes

### Important Considerations

1. **Token Management**: The service automatically handles token renewal. No manual intervention needed.

2. **Cabinet Online Status**: Check `is_online` combined with `heart_time`:
   - `is_online = 1` and recent `heart_time` → Cabinet is online
   - `is_online = 0` or old `heart_time` → Cabinet is offline
   - Heartbeat interval: typically 45 seconds

3. **Slot Information**: When `bid` (battery ID) is empty, the slot is empty.

4. **Image URLs**: All image URLs for screen management must use HTTPS.

5. **Equipment Group Format**: Cabinet IDs in AD plans should be comma-separated (e.g., "CT123,CT456,CT789").

6. **Date Format**: Dates should be in `Y-m-d` format (e.g., "2024-12-25").

## Integration with Existing System

The WsCharge HTTP API service works alongside the existing WebSocket service:

- **WebSocket Service** ([wscharge.service.ts](src/services/wscharge.service.ts)):
  - Real-time bidirectional communication with physical cabinets
  - Handles device login, inventory updates, rent/return events

- **HTTP API Service** ([wscharge-api.service.ts](src/services/wscharge-api.service.ts)):
  - Management operations (add/edit/delete cabinets)
  - Query operations (cabinet list, battery list, details)
  - Screen advertising management
  - System configuration

Both services can be used together for a complete solution.

## Support

For API issues or questions:
- Check the [Official Documentation](https://api.w-dian.cn/docs) (if available)
- Contact WsCharge support
- Review the API response error messages

## Changelog

### v1.0.0 (2024-12-XX)
- Initial implementation based on WsCharge API Documentation v1.0.0
- Complete CRUD operations for cabinets and batteries
- Screen advertising management (materials, groups, plans)
- System settings management
- Token-based authentication with auto-renewal
