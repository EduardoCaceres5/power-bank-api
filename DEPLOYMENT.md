# Guía de Deployment a Vercel

Esta guía te ayudará a hacer deploy de tu backend Power Bank API a Vercel.

## Pre-requisitos

1. Cuenta en [Vercel](https://vercel.com)
2. [Vercel CLI](https://vercel.com/cli) instalado (opcional, pero recomendado)
3. Base de datos PostgreSQL ya configurada (Supabase)
4. Credenciales de WsCharge

## Instalación de Vercel CLI (Opcional)

```bash
npm i -g vercel
```

## Paso 1: Preparar el Proyecto

El proyecto ya está configurado con:
- ✅ `vercel.json` - Configuración de build y rutas
- ✅ `.vercelignore` - Archivos a ignorar en el deploy
- ✅ `package.json` - Scripts de build actualizados

## Paso 2: Variables de Entorno en Vercel

Debes configurar las siguientes variables de entorno en tu proyecto de Vercel. Ve a tu proyecto → Settings → Environment Variables:

### Variables Requeridas

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Supabase Configuration
SUPABASE_URL=https://xikzbxjcepmvbenrtslo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa3pieGpjZXBtdmJlbnJ0c2xvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTI0OTYsImV4cCI6MjA3NjIyODQ5Nn0.0TiXORDmhRu65jK4wnDL-C7PFva2hyVyxSaSJJ-V7EQ
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-real

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres.xikzbxjcepmvbenrtslo:xDQ8n49SNIO2EKyl@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
DIRECT_URL=postgresql://postgres.xikzbxjcepmvbenrtslo:xDQ8n49SNIO2EKyl@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_o_live_tu_key_real
STRIPE_PUBLISHABLE_KEY=pk_test_o_live_tu_key_real
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret_real

# WsCharge Configuration (HTTP API)
WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=samuelcharge
WSCHARGE_USERNAME=admin
WSCHARGE_PASSWORD=111111

# WsCharge Configuration
WSCHARGE_SERVICE_ID=tu-service-id
WSCHARGE_TIMEOUT=30000

# JWT Secret
JWT_SECRET=tu-super-secret-jwt-key-produccion

# CORS Origins (URLs de tu frontend)
CORS_ORIGINS=https://tu-app.vercel.app,https://www.tu-dominio.com

# Logging
LOG_LEVEL=info
```

### Dónde obtener las credenciales:

1. **Supabase**:
   - Ve a tu proyecto en Supabase
   - Settings → API → Project API keys
   - Copia `anon` y `service_role` keys

2. **Stripe**:
   - Dashboard de Stripe → Developers → API keys
   - Para producción usa las keys que empiezan con `sk_live_` y `pk_live_`

3. **JWT_SECRET**:
   - Genera uno seguro: `openssl rand -base64 32`

## Paso 3: Deploy

### Opción A: Deploy con Vercel CLI (Recomendado)

1. **Login en Vercel:**
   ```bash
   vercel login
   ```

2. **Deploy a preview (ambiente de prueba):**
   ```bash
   vercel
   ```

3. **Deploy a producción:**
   ```bash
   vercel --prod
   ```

### Opción B: Deploy desde GitHub

1. **Sube tu código a GitHub**

2. **Importa el proyecto en Vercel:**
   - Ve a [vercel.com/new](https://vercel.com/new)
   - Selecciona "Import Git Repository"
   - Conecta tu repositorio de GitHub
   - Selecciona el directorio `backend`

3. **Configura las variables de entorno:**
   - En la sección de configuración, agrega todas las variables de entorno mencionadas arriba

4. **Deploy:**
   - Click en "Deploy"
   - Vercel automáticamente:
     - Ejecutará `npm install`
     - Ejecutará `npm run vercel-build` (Prisma generate + migrate)
     - Ejecutará `npm run build` (compilación TypeScript)
     - Desplegará tu aplicación

### Opción C: Deploy con botón de Vercel

Puedes agregar un botón "Deploy to Vercel" a tu README:

```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tu-usuario/tu-repo)
```

## Paso 4: Configurar Dominios

1. Ve a tu proyecto en Vercel → Settings → Domains
2. Agrega tu dominio personalizado (opcional)
3. Actualiza `CORS_ORIGINS` con tu dominio de producción

## Paso 5: Verificar el Deploy

Una vez deployado, verifica que todo funcione:

1. **Health check:**
   ```bash
   curl https://tu-app.vercel.app/
   ```

   Deberías recibir:
   ```json
   {
     "name": "Power Bank API",
     "version": "v1",
     "status": "running",
     "timestamp": "2025-11-07T..."
   }
   ```

2. **API endpoint:**
   ```bash
   curl https://tu-app.vercel.app/api/v1/
   ```

## Paso 6: Configurar Webhooks de Stripe (Producción)

1. Ve a Stripe Dashboard → Developers → Webhooks
2. Agrega un nuevo endpoint:
   - URL: `https://tu-app.vercel.app/api/v1/webhooks/stripe`
   - Events: Selecciona los eventos que necesites (ej: `payment_intent.succeeded`)
3. Copia el `Signing secret` y actualiza `STRIPE_WEBHOOK_SECRET` en Vercel

## Paso 7: Migraciones de Base de Datos

Las migraciones se ejecutan automáticamente en el build gracias al script `vercel-build`:

```json
"vercel-build": "prisma generate && prisma migrate deploy"
```

Si necesitas ejecutar migraciones manualmente:

```bash
npx prisma migrate deploy
```

## Consideraciones Importantes

### 🔴 WebSocket Limitations

**IMPORTANTE**: Vercel Serverless Functions tienen limitaciones con WebSockets:

- Las funciones serverless tienen un timeout de 30 segundos (máximo)
- Los WebSockets persistentes NO son soportados en Vercel Serverless

Para tu servicio de WebSocket con WsCharge (`WsChargeService`), tienes 2 opciones:

#### Opción 1: Deploy WebSocket en otro servicio (Recomendado)

Separa tu backend en dos partes:
- **API REST en Vercel** (endpoints HTTP)
- **WebSocket en Railway/Render/Fly.io** (comunicación con gabinetes)

#### Opción 2: Usar Vercel Edge Functions

Considera usar Edge Functions que tienen mejor soporte para conexiones en tiempo real.

### 📊 Logs y Monitoreo

- Ve a tu proyecto en Vercel → Deployments → Ver logs
- Para logs en tiempo real: `vercel logs`
- Para logs de producción: `vercel logs --prod`

### 🔄 Redeploy

Cada push a tu rama principal en GitHub disparará un nuevo deploy automáticamente.

Para redeploy manual:
```bash
vercel --prod
```

### 💰 Pricing

Vercel Free tier incluye:
- 100 GB bandwidth
- Unlimited requests
- 100 GB-hrs serverless function execution

Para apps con tráfico intenso, considera el plan Pro.

## Troubleshooting

### Error: "Cannot find module"

Asegúrate de que todas las dependencias estén en `dependencies` (no en `devDependencies`):
```bash
npm install --save @prisma/client express cors helmet
```

### Error: Prisma Client

Si ves errores de Prisma Client:
1. Verifica que `vercel-build` esté en `package.json`
2. Asegúrate de que `DATABASE_URL` esté configurada en Vercel

### Error: Environment Variables

- Las variables de entorno deben configurarse en Vercel Dashboard
- NO uses archivo `.env` en producción
- Vercel inyecta las variables automáticamente

### Timeout Errors

Si tus funciones tardan más de 10 segundos:
- Optimiza tus queries de base de datos
- Considera usar background jobs
- Actualiza a Vercel Pro para timeouts de 60s

## Comandos Útiles

```bash
# Ver información del proyecto
vercel

# Ver logs en tiempo real
vercel logs --follow

# Ver variables de entorno
vercel env ls

# Agregar variable de entorno
vercel env add

# Remover deployment
vercel remove [deployment-url]

# Inspeccionar deployment
vercel inspect [deployment-url]
```

## Recursos

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

## Próximos Pasos

1. ✅ Deploy exitoso
2. Configura monitoreo (opcional: Sentry, LogRocket)
3. Configura CI/CD con GitHub Actions (opcional)
4. Implementa rate limiting para producción
5. Configura backup automático de base de datos
6. Deploy del frontend a Vercel
7. Considera un servicio separado para WebSockets

---

¿Problemas? Revisa los logs en Vercel Dashboard o ejecuta `vercel logs --prod` para ver errores en tiempo real.
