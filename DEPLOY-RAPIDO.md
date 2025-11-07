# Deploy Rápido a Vercel

## 🚀 Paso a Paso Rápido

### 1. Instalar Vercel CLI

```bash
npm i -g vercel
```

### 2. Login en Vercel

```bash
vercel login
```

### 3. Deploy

```bash
# Desde la carpeta backend
cd c:\Users\ecaceres\proyectos\personal\power-bank-app\backend

# Deploy a preview (prueba)
vercel

# O deploy directo a producción
vercel --prod
```

### 4. Configurar Variables de Entorno en Vercel Dashboard

Ve a tu proyecto en [vercel.com](https://vercel.com) → Settings → Environment Variables

Copia y pega estas variables (reemplaza los valores si es necesario):

```env
NODE_ENV=production
PORT=3000
API_VERSION=v1

SUPABASE_URL=https://xikzbxjcepmvbenrtslo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa3pieGpjZXBtdmJlbnJ0c2xvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTI0OTYsImV4cCI6MjA3NjIyODQ5Nn0.0TiXORDmhRu65jK4wnDL-C7PFva2hyVyxSaSJJ-V7EQ
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

DATABASE_URL=postgresql://postgres.xikzbxjcepmvbenrtslo:xDQ8n49SNIO2EKyl@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
DIRECT_URL=postgresql://postgres.xikzbxjcepmvbenrtslo:xDQ8n49SNIO2EKyl@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require

STRIPE_SECRET_KEY=sk_test_tu_key
STRIPE_PUBLISHABLE_KEY=pk_test_tu_key
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook

WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=samuelcharge
WSCHARGE_USERNAME=admin
WSCHARGE_PASSWORD=111111
WSCHARGE_SERVICE_ID=tu-service-id
WSCHARGE_TIMEOUT=30000

JWT_SECRET=genera-un-secret-seguro-aqui

CORS_ORIGINS=https://tu-frontend.vercel.app

LOG_LEVEL=info
```

**Importante**: Asegúrate de obtener el `SUPABASE_SERVICE_ROLE_KEY` real desde Supabase Dashboard.

### 5. Redeploy después de configurar variables

```bash
vercel --prod
```

### 6. Verificar que funciona

```bash
curl https://tu-app.vercel.app/
```

Deberías ver:
```json
{
  "name": "Power Bank API",
  "version": "v1",
  "status": "running",
  "timestamp": "..."
}
```

## ⚠️ Importante: WebSockets

Vercel serverless NO soporta WebSockets persistentes. La parte del `WsChargeService` (Socket.io) **NO funcionará** en Vercel.

### Opciones:

1. **Deploy WebSocket en otro servicio** (Recomendado):
   - Deploy la API REST en Vercel
   - Deploy el WebSocket en Railway, Render, o Fly.io

2. **Usar un solo servidor en Railway/Render**:
   - Deploy todo el backend en un servicio que soporte WebSockets
   - Railway o Render son buenas opciones

## 📝 Archivos Importantes Creados

- ✅ [vercel.json](vercel.json) - Configuración de Vercel
- ✅ [api/index.ts](api/index.ts) - Entry point para serverless
- ✅ [.vercelignore](.vercelignore) - Archivos a ignorar
- ✅ [package.json](package.json) - Script `vercel-build` agregado
- ✅ [DEPLOYMENT.md](DEPLOYMENT.md) - Guía completa de deployment

## 🔧 Comandos Útiles

```bash
# Ver logs en tiempo real
vercel logs --follow

# Ver logs de producción
vercel logs --prod

# Ver información del proyecto
vercel

# Agregar variable de entorno
vercel env add

# Remover deployment
vercel remove [deployment-url]
```

## 🆘 Problemas Comunes

### Error: "Cannot find module"
- Verifica que todas las dependencias estén en `dependencies` (no en `devDependencies`)

### Error: Prisma Client
- Asegúrate de configurar `DATABASE_URL` en Vercel
- El script `vercel-build` debería ejecutarse automáticamente

### Timeout Errors
- Las funciones serverless tienen límite de 10s (free tier) o 60s (pro tier)
- Optimiza tus queries de base de datos

## 📚 Documentación Completa

Para más detalles, ve a [DEPLOYMENT.md](DEPLOYMENT.md)
