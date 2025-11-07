# Deploy a Railway - Guía Completa

Railway es la plataforma ideal para tu backend porque **soporta WebSockets nativamente**, a diferencia de Vercel.

## 🚀 Deploy Rápido (5 minutos)

### Opción 1: Deploy desde GitHub (Recomendado)

1. **Sube tu código a GitHub** (si aún no lo has hecho)
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/tu-repo.git
   git push -u origin main
   ```

2. **Ve a Railway**
   - Abre [railway.app](https://railway.app)
   - Click en "Start a New Project"
   - Selecciona "Deploy from GitHub repo"
   - Autoriza Railway para acceder a tus repos
   - Selecciona tu repositorio

3. **Railway detectará automáticamente:**
   - ✅ `Dockerfile` - Usará Docker para el build
   - ✅ `railway.json` - Configuración del proyecto
   - ✅ Node.js y dependencias

4. **Configurar Variables de Entorno** (ver sección abajo)

5. **Deploy automático** - Railway desplegará tu app automáticamente

### Opción 2: Deploy con Railway CLI

1. **Instalar Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login**
   ```bash
   railway login
   ```

3. **Inicializar proyecto**
   ```bash
   cd c:\Users\ecaceres\proyectos\personal\power-bank-app\backend
   railway init
   ```

4. **Configurar variables de entorno**
   ```bash
   railway variables
   ```

5. **Deploy**
   ```bash
   railway up
   ```

## 🔐 Variables de Entorno Requeridas

Configura estas variables en Railway Dashboard (Settings → Variables):

### Método 1: Una por una en la UI

Ve a tu proyecto → Settings → Variables → Raw Editor y pega:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Supabase Configuration
SUPABASE_URL=https://xikzbxjcepmvbenrtslo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa3pieGpjZXBtdmJlbnJ0c2xvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTI0OTYsImV4cCI6MjA3NjIyODQ5Nn0.0TiXORDmhRu65jK4wnDL-C7PFva2hyVyxSaSJJ-V7EQ
SUPABASE_SERVICE_ROLE_KEY=obtener-de-supabase-dashboard

# Database (Usa las credenciales de Supabase o crea una base de datos en Railway)
DATABASE_URL=postgresql://postgres.xikzbxjcepmvbenrtslo:xDQ8n49SNIO2EKyl@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
DIRECT_URL=postgresql://postgres.xikzbxjcepmvbenrtslo:xDQ8n49SNIO2EKyl@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_o_live_tu_key
STRIPE_PUBLISHABLE_KEY=pk_test_o_live_tu_key
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook

# WsCharge Configuration
WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=samuelcharge
WSCHARGE_USERNAME=admin
WSCHARGE_PASSWORD=111111
WSCHARGE_SERVICE_ID=tu-service-id
WSCHARGE_TIMEOUT=30000

# JWT Secret (genera uno seguro)
JWT_SECRET=genera-un-secret-muy-seguro-aqui

# CORS Origins (agrega tu dominio de Railway después del deploy)
CORS_ORIGINS=https://tu-frontend.vercel.app,https://tu-app.railway.app

# Logging
LOG_LEVEL=info
```

### Método 2: Con Railway CLI

```bash
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set DATABASE_URL="postgresql://..."
# ... etc
```

### 📝 Notas Importantes sobre Variables:

1. **PORT**: Railway asigna el puerto automáticamente vía `process.env.PORT`
2. **DATABASE_URL**: Puedes usar tu Supabase actual O crear una PostgreSQL en Railway
3. **CORS_ORIGINS**: Después del primer deploy, agrega tu dominio de Railway aquí
4. **SUPABASE_SERVICE_ROLE_KEY**: Obtenerlo de Supabase → Settings → API → service_role key

## 📦 Opción: Usar PostgreSQL de Railway

Si prefieres no usar Supabase, Railway puede crear una base de datos PostgreSQL:

1. En tu proyecto de Railway → "+ New" → "Database" → "PostgreSQL"
2. Railway creará automáticamente las variables:
   - `DATABASE_URL`
   - `DATABASE_PUBLIC_URL`
   - `DATABASE_PRIVATE_URL`
3. Actualiza tu `.env` y las variables de Railway

## 🔄 Proceso de Build

Railway ejecutará automáticamente:

1. **Build** (definido en `railway.json`):
   ```bash
   npm install
   npm run build  # Genera Prisma Client + compila TypeScript
   ```

2. **Migrations** (al iniciar):
   ```bash
   npx prisma migrate deploy
   ```

3. **Start**:
   ```bash
   npm start  # node dist/server.js
   ```

## 🌐 Obtener tu URL Pública

Después del deploy:

1. Ve a tu proyecto en Railway
2. Click en "Settings" → "Networking"
3. Click en "Generate Domain"
4. Tu app estará disponible en: `https://tu-app.up.railway.app`

**Importante**: Agrega este dominio a `CORS_ORIGINS`

## ✅ Verificar el Deploy

Una vez deployado:

### 1. Health Check
```bash
curl https://tu-app.up.railway.app/
```

Deberías ver:
```json
{
  "name": "Power Bank API",
  "version": "v1",
  "status": "running",
  "timestamp": "2025-11-07T..."
}
```

### 2. Verificar API
```bash
curl https://tu-app.up.railway.app/api/v1/
```

### 3. Verificar WebSocket (desde tu emulador)

Actualiza el archivo [scripts/cabinet-emulator.ts](scripts/cabinet-emulator.ts):

```typescript
const SERVER_URL = 'https://tu-app.up.railway.app';
```

Luego ejecuta:
```bash
npm run emulate:cabinet
```

Deberías ver la conexión exitosa al WebSocket en Railway.

## 🔍 Monitoreo y Logs

### Ver logs en tiempo real:

**Opción 1: Railway Dashboard**
- Ve a tu proyecto → "Deployments" → Click en el deployment actual
- Los logs aparecerán en tiempo real

**Opción 2: Railway CLI**
```bash
# Logs en tiempo real
railway logs

# Logs de un deployment específico
railway logs --deployment [id]
```

### Métricas:
- Railway Dashboard → "Metrics"
- Verás CPU, memoria, network usage

## 🔄 Redeploys y CI/CD

Railway tiene **auto-deploy** activado por defecto:

- Cada `git push` a tu rama principal → Deploy automático
- Cada PR → Preview deployment automático
- Para desactivar: Settings → Deployments → Desactiva "Automatic Deploys"

### Deploy manual:
```bash
railway up
```

### Rollback a deployment anterior:
1. Railway Dashboard → Deployments
2. Click en un deployment anterior
3. Click "Redeploy"

## 🛠️ Configuración Avanzada

### Agregar Healthcheck personalizado

Ya está configurado en el `Dockerfile`:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

### Configurar dominios personalizados

1. Railway Dashboard → Settings → Networking → Custom Domains
2. Agrega tu dominio (ej: `api.tudominio.com`)
3. Configura el DNS según las instrucciones de Railway
4. Actualiza `CORS_ORIGINS` con tu nuevo dominio

### Configurar Webhooks de Stripe

1. Stripe Dashboard → Developers → Webhooks
2. Agrega endpoint: `https://tu-app.up.railway.app/api/v1/webhooks/stripe`
3. Selecciona eventos necesarios
4. Copia el `Signing secret`
5. Actualiza `STRIPE_WEBHOOK_SECRET` en Railway

## 💰 Costos de Railway

Railway tiene un plan gratuito con:
- $5 de crédito gratis cada mes
- Si se acaba, la app se pausará hasta el siguiente mes

**Costos aproximados:**
- Backend pequeño/mediano: ~$2-5/mes
- Base de datos PostgreSQL: ~$3-8/mes (si la creas en Railway)

**Plan Pro**: $20/mes con más recursos y sin límites

## 🆘 Troubleshooting

### Error: "Cannot find module @prisma/client"

**Solución**: Asegúrate de que el build incluye `prisma generate`
```json
"build": "prisma generate && tsc"
```

### Error: "Port already in use"

Railway asigna el puerto automáticamente. Asegúrate de usar:
```typescript
const PORT = process.env.PORT || 3000;
```

### Error: Migrations fallan

**Opción 1**: Ejecuta migraciones manualmente
```bash
railway run npx prisma migrate deploy
```

**Opción 2**: Agrega seed después de migraciones
```bash
railway run npm run prisma:seed
```

### WebSocket no conecta

1. Verifica que el dominio en el cliente use `https://` (no `http://`)
2. Para WebSocket usa `wss://` (no `ws://`)
3. Asegúrate de que CORS esté configurado correctamente

### Build muy lento

El Dockerfile usa multi-stage build para optimizar. Si es muy lento:
1. Verifica que `.dockerignore` excluya `node_modules`
2. Railway cachea layers, el segundo build será más rápido

## 📚 Recursos

- [Railway Docs](https://docs.railway.app)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [Prisma + Railway](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-railway)

## 🔄 Comparación: Railway vs Vercel

| Feature | Railway | Vercel |
|---------|---------|--------|
| **WebSockets** | ✅ Sí | ❌ No (serverless) |
| **Docker** | ✅ Sí | ⚠️ Limitado |
| **Base de datos** | ✅ PostgreSQL integrado | ❌ Solo serverless DB |
| **Costo mensual** | ~$5-10 | ~$0-20 |
| **Auto-deploy** | ✅ Sí | ✅ Sí |
| **Dominios custom** | ✅ Gratis | ✅ Gratis |
| **Mejor para** | Apps con WebSocket/DB | Frontend + Serverless API |

**Para tu proyecto**: Railway es la mejor opción porque necesitas WebSocket para los gabinetes.

## 🎯 Siguiente Paso

Después de deployar en Railway:

1. ✅ Actualiza `CORS_ORIGINS` con tu dominio de Railway
2. ✅ Configura webhooks de Stripe con tu nueva URL
3. ✅ Prueba la conexión del emulador de gabinete
4. ✅ Configura tu frontend para apuntar a la API de Railway
5. ✅ (Opcional) Agrega dominio personalizado

---

¿Problemas? Revisa los logs con `railway logs` o en el Dashboard.
