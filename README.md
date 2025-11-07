# Power Bank Backend API

Backend API for Power Bank rental system with WsCharge integration.

## Features

- 🔌 **Dual WsCharge Integration**:
  - WebSocket protocol for real-time cabinet communication
  - HTTP REST API for cabinet management and advertising
- 🏢 **Cabinet Management**: Add, edit, delete, and monitor power bank cabinets
- 🔋 **Power Bank Tracking**: Real-time battery status and inventory
- 📱 **Rental System**: Complete rental lifecycle management
- 🖼️ **Advertising Management**: Screen advertising with materials, groups, and plans
- ⚙️ **System Configuration**: Battery power settings, webhooks, QR codes
- 💳 **Payment Integration**: Stripe payment processing
- 🔐 **Authentication**: Token-based auth with auto-renewal
- 📊 **Database**: Prisma ORM with PostgreSQL

## Architecture

```
┌─────────────────┐
│   Client App    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Express API    │◄────►│  WsCharge HTTP   │
│   (REST API)    │      │      API         │
└────────┬────────┘      └──────────────────┘
         │
         ├─► Supabase (Auth)
         ├─► PostgreSQL (Database)
         ├─► Stripe (Payments)
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Socket.IO      │◄────►│  WsCharge        │
│   WebSocket     │      │   Cabinets       │
└─────────────────┘      └──────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Supabase account
- WsCharge API credentials
- Stripe account (for payments)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd power-bank-app/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/powerbank_db
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   WSCHARGE_API_URL=https://api.w-dian.cn/operate
   WSCHARGE_USERNAME=your_username
   WSCHARGE_PASSWORD=your_password
   STRIPE_SECRET_KEY=your_stripe_secret_key
   ```

4. **Set up the database**
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Core Endpoints

#### Health Check
```http
GET /api/v1/health
```

#### Cabinets (Local Management)
```http
GET    /api/v1/cabinets          # List all cabinets
GET    /api/v1/cabinets/:id      # Get cabinet details
POST   /api/v1/cabinets          # Create cabinet
PUT    /api/v1/cabinets/:id      # Update cabinet
DELETE /api/v1/cabinets/:id      # Delete cabinet
```

#### Rentals
```http
GET    /api/v1/rentals           # List rentals
GET    /api/v1/rentals/:id       # Get rental details
POST   /api/v1/rentals           # Create rental
PUT    /api/v1/rentals/:id       # Update rental
```

### WsCharge HTTP API Integration

For complete WsCharge API documentation, see **[WSCHARGE_API.md](./WSCHARGE_API.md)**

#### Authentication
```http
POST /api/v1/wscharge/auth/login
GET  /api/v1/wscharge/auth/status
```

#### Device Management
```http
POST   /api/v1/wscharge/cabinets              # Add cabinet
GET    /api/v1/wscharge/cabinets              # List cabinets
GET    /api/v1/wscharge/cabinets/:id          # Get cabinet info
PUT    /api/v1/wscharge/cabinets/:id          # Update cabinet
DELETE /api/v1/wscharge/cabinets/:id          # Delete cabinet
GET    /api/v1/wscharge/cabinets/:id/details  # Get real-time details
POST   /api/v1/wscharge/cabinets/:id/command  # Issue command
```

#### Screen Advertising
```http
POST   /api/v1/wscharge/screen/materials      # Add material
GET    /api/v1/wscharge/screen/materials      # List materials
POST   /api/v1/wscharge/screen/groups         # Add group
GET    /api/v1/wscharge/screen/groups         # List groups
POST   /api/v1/wscharge/screen/plans          # Add plan
GET    /api/v1/wscharge/screen/plans          # List plans
```

#### System Settings
```http
GET  /api/v1/wscharge/settings/:type          # Get config
POST /api/v1/wscharge/settings                # Set config
```

## WebSocket Integration

The WebSocket server for real-time cabinet communication is available at:
```
ws://localhost:3000/wscharge
```

### WebSocket Events

#### From Cabinet → Server
- Login (Function 60)
- Offline (Function 90)
- Inventory Response (Function 64)
- Rent Response (Function 65)
- Return Power Bank (Function 66)

#### From Server → Cabinet
- Query Inventory (Function 64)
- Rent Power Bank (Function 65)
- Force Eject (Function 80)
- Full Eject (Function 81)
- Restart Device (Function 67)

See [src/types/wscharge.types.ts](src/types/wscharge.types.ts) for detailed protocol definitions.

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload

# Database
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:deploy    # Deploy migrations to production

# Build
npm run build            # Build for production
npm start                # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

### Project Structure

```
backend/
├── src/
│   ├── controllers/          # Request handlers
│   │   ├── cabinet.controller.ts
│   │   ├── rental.controller.ts
│   │   └── wscharge-api.controller.ts
│   ├── services/             # Business logic
│   │   ├── wscharge.service.ts        # WebSocket service
│   │   ├── wscharge-api.service.ts    # HTTP API service
│   │   ├── rental.service.ts
│   │   └── stripe.service.ts
│   ├── routes/               # API routes
│   │   ├── cabinet.routes.ts
│   │   ├── rental.routes.ts
│   │   ├── wscharge-api.routes.ts
│   │   └── index.ts
│   ├── middleware/           # Express middleware
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   ├── types/                # TypeScript types
│   │   ├── wscharge.types.ts          # WebSocket protocol
│   │   ├── wscharge-api.types.ts      # HTTP API types
│   │   └── express.d.ts
│   ├── lib/                  # Shared utilities
│   │   ├── prisma.ts
│   │   ├── supabase.ts
│   │   └── logger.ts
│   ├── utils/                # Helper functions
│   └── server.ts             # Express app setup
├── prisma/
│   └── schema.prisma         # Database schema
├── .env.example              # Environment variables template
├── tsconfig.json             # TypeScript configuration
├── package.json
├── README.md                 # This file
└── WSCHARGE_API.md          # WsCharge API documentation
```

## Database Schema

The application uses PostgreSQL with Prisma ORM. Main entities:

- **Cabinet**: Power bank cabinet information
- **Slot**: Individual slots in cabinets
- **PowerBank**: Power bank devices
- **Rental**: Rental transactions
- **User**: User accounts (via Supabase)

See [prisma/schema.prisma](prisma/schema.prisma) for the complete schema.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Server port (default: 3000) | No |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `WSCHARGE_API_URL` | WsCharge API base URL | Yes |
| `WSCHARGE_USERNAME` | WsCharge account username | Yes |
| `WSCHARGE_PASSWORD` | WsCharge account password | Yes |
| `STRIPE_SECRET_KEY` | Stripe secret key | Yes |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | No |

See [.env.example](.env.example) for the complete list.

## Testing

### Manual Testing

1. Start the server: `npm run dev`
2. Use Postman, Insomnia, or curl to test endpoints
3. Check logs for detailed information

### Example Requests

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Login to WsCharge API
curl -X POST http://localhost:3000/api/v1/wscharge/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"username","password":"password"}'

# Get cabinet list
curl http://localhost:3000/api/v1/wscharge/cabinets?page=1

# Rent power bank
curl -X POST http://localhost:3000/api/v1/wscharge/cabinets/CT123456/command \
  -H "Content-Type: application/json" \
  -d '{"type":"borrow","lock_id":1,"order_no":"ORD123"}'
```

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong passwords and secrets
- [ ] Configure CORS_ORIGINS properly
- [ ] Set up SSL/TLS certificates
- [ ] Configure database backup
- [ ] Set up monitoring and logging
- [ ] Run database migrations: `npm run prisma:deploy`
- [ ] Build the application: `npm run build`
- [ ] Use a process manager (PM2, systemd)

### Docker Deployment (Coming Soon)

```bash
docker build -t powerbank-backend .
docker run -p 3000:3000 --env-file .env powerbank-backend
```

## Error Handling

The API uses standardized error responses:

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

## Logging

The application uses Winston for structured logging:

- Development: Console output with colors
- Production: JSON logs to files
- Log levels: error, warn, info, debug

Logs include:
- Request/response logs (via Morgan)
- API errors
- Database operations
- WebSocket events

## Security

- ✅ Helmet.js for security headers
- ✅ CORS configuration
- ✅ Rate limiting (recommended)
- ✅ Input validation
- ✅ Environment variable validation
- ✅ Token-based authentication
- ✅ SQL injection prevention (Prisma)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT

## Support

For issues or questions:
- Create an issue on GitHub
- Contact the development team
- Check the [WsCharge API Documentation](./WSCHARGE_API.md)

## Changelog

### v1.0.0 (Current)
- Initial release
- WebSocket integration for real-time cabinet communication
- HTTP API integration for cabinet management
- Screen advertising management
- Stripe payment integration
- PostgreSQL database with Prisma
- Supabase authentication
- Complete CRUD operations
- Token management with auto-renewal
