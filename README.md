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

## 📚 Documentation

Comprehensive documentation is available in the [docs/](docs/) directory:

- **[API Endpoints](docs/api/endpoints.md)** - Complete API reference
- **[WsCharge Integration](docs/api/wscharge.md)** - WsCharge API documentation
- **[Authentication Guide](docs/guides/authentication.md)** - JWT auth, roles & permissions
- **[Device Integration](docs/guides/device-integration.md)** - Cabinet connection & heartbeats
- **[Deployment](docs/deployment/)** - Railway, Vercel, and other platforms

### Quick API Reference

Base URL: `http://localhost:3000/api/v1`

```bash
# Health check
GET /api/v1/health

# Authentication
POST /api/v1/auth/login
POST /api/v1/auth/register

# Cabinets
GET    /api/v1/cabinets
POST   /api/v1/cabinets
GET    /api/v1/cabinets/:id
PUT    /api/v1/cabinets/:id
DELETE /api/v1/cabinets/:id

# Rentals
GET  /api/v1/rentals
POST /api/v1/rentals
GET  /api/v1/rentals/:id
PUT  /api/v1/rentals/:id
```

See [docs/api/endpoints.md](docs/api/endpoints.md) for complete documentation.

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload

# Cabinet Management (WsCharge)
npm run setup:cabinet    # Register cabinet GT042250704279 with WsCharge API
npm run check:cabinet    # Check if cabinet is online and get status
npm run emulate:cabinet  # Emulate a cabinet connecting to your local server

# Database
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:deploy    # Deploy migrations to production
npm run prisma:seed      # Seed database with initial data

# Build
npm run build            # Build for production
npm start                # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

### WsCharge Cabinet Scripts

El proyecto incluye scripts útiles para gestionar tu gabinete PM8 (ID: GT042250704279):

1. **Setup Cabinet** - Registrar gabinete en WsCharge API
   ```bash
   npm run setup:cabinet
   ```
   - Verifica autenticación con WsCharge
   - Registra el gabinete si no existe
   - Obtiene información y detalles del gabinete

2. **Check Cabinet Status** - Verificar si el gabinete está online
   ```bash
   npm run check:cabinet
   ```
   - Verifica estado online/offline
   - Muestra último heartbeat
   - Lista power banks en slots (si está online)

3. **Cabinet Emulator** - Emular gabinete localmente
   ```bash
   npm run emulate:cabinet
   ```
   - Simula un gabinete PM8 conectándose a tu servidor local
   - Útil para desarrollo sin hardware físico
   - Responde a comandos de inventario y renta

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
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | Yes* |

*Required in production. See [Production CORS Setup](#production-cors-setup) below.

See [.env.example](.env.example) for the complete list.

### Production CORS Setup

**Important:** When deploying to production (Railway, Render, etc.), you MUST configure the `CORS_ORIGINS` environment variable with your frontend domain(s).

**For Railway:**
1. Go to your Railway project dashboard
2. Select your API service
3. Navigate to "Variables" tab
4. Add a new variable:
   - **Key:** `CORS_ORIGINS`
   - **Value:** `https://power-bank-app.vercel.app`

**Multiple domains** (production + staging):
```
CORS_ORIGINS=https://power-bank-app.vercel.app,https://power-bank-app-staging.vercel.app
```

**Why this is required:**
- Your API uses `credentials: true` in CORS configuration
- This requires explicitly whitelisting frontend domains
- Without this, browsers will block requests with CORS errors

**Local development:**
```
CORS_ORIGINS=http://localhost:5173,http://localhost:19006
```

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

### Railway (Recommended)

Railway is recommended because it supports WebSockets (required for cabinet communication).

**Quick Deploy (3 steps):**
1. Push to GitHub
2. Connect repo on [railway.app](https://railway.app)
3. Configure environment variables

See [docs/deployment/railway.md](docs/deployment/railway.md) for complete guide.

### Other Options

- **Vercel** - For REST API only (no WebSocket support) - [docs/deployment/vercel.md](docs/deployment/vercel.md)
- **Platform Comparison** - [docs/deployment/options.md](docs/deployment/options.md)

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure strong JWT_SECRET
- [ ] Set CORS_ORIGINS to your frontend domain
- [ ] Run database migrations: `npm run prisma:deploy`
- [ ] Seed initial data: `npm run prisma:seed`
- [ ] Verify health endpoint is accessible

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
