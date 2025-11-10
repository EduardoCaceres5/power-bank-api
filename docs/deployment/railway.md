# Guía de Despliegue en Railway

Railway es la plataforma ideal para este backend porque **soporta WebSockets nativamente**, necesario para la comunicación con los gabinetes WsCharge.

## ¿Por qué Railway?

✅ **WebSockets soportados** (requerido para los gabinetes)
✅ **Deploy automático** desde GitHub
✅ **PostgreSQL incluido** (opcional, puedes usar Supabase)
✅ **Fácil configuración**
✅ **$5 USD gratis** cada mes
✅ **Logs en tiempo real**

---

## 🚀 Deploy Rápido (3 pasos)

### Paso 1: Subir código a GitHub

```bash
cd c:\Users\ecaceres\proyectos\personal\power-bank-app\backend

git init
git add .
git commit -m "Backend ready for Railway deployment"
git branch -M main

# Crea un repo en GitHub y luego:
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

### Paso 2: Deploy en Railway

1. Ve a [railway.app](https://railway.app)
2. **Sign up / Login** (puedes usar GitHub)
3. Click **"Start a New Project"**
4. Selecciona **"Deploy from GitHub repo"**
5. Autoriza Railway para acceder a tus repos
6. Selecciona tu repositorio del backend
7. Railway detectará automáticamente el proyecto Node.js

### Paso 3: Configurar Variables de Entorno

1. En Railway Dashboard → Tu proyecto → **Variables**
2. Click **"Raw Editor"** (arriba a la derecha)
3. Pega estas variables (reemplaza los valores):

```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database (Supabase)
DATABASE_URL=postgresql://postgres.xikzbxjcepmvbenrtslo:xDQ8n49SNIO2EKyl@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
DIRECT_URL=postgresql://postgres.xikzbxjcepmvbenrtslo:xDQ8n49SNIO2EKyl@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require

# Supabase Auth
SUPABASE_URL=https://xikzbxjcepmvbenrtslo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa3pieGpjZXBtdmJlbnJ0c2xvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTI0OTYsImV4cCI6MjA3NjIyODQ5Nn0.0TiXORDmhRu65jK4wnDL-C7PFva2hyVyxSaSJJ-V7EQ
SUPABASE_SERVICE_ROLE_KEY=VE-A-SUPABASE-Y-OBTENLO

# JWT
JWT_SECRET=genera-un-string-super-seguro-aqui-con-openssl-rand-base64-32
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_TU_KEY_AQUI
STRIPE_PUBLISHABLE_KEY=pk_test_TU_KEY_AQUI
STRIPE_WEBHOOK_SECRET=whsec_TU_WEBHOOK

# WsCharge API
WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=samuelcharge
WSCHARGE_USERNAME=admin
WSCHARGE_PASSWORD=111111
WSCHARGE_SERVICE_ID=tu-service-id
WSCHARGE_TIMEOUT=30000

# CORS (actualiza después del deploy)
CORS_ORIGINS=https://tu-frontend.vercel.app

# Logging
LOG_LEVEL=info
```

4. Click **"Update Variables"**
5. Railway re-desplegará automáticamente

---

## ✅ Verificar el Deploy

### 1. Obtener tu URL

- Railway Dashboard → Settings → Networking → **Generate Domain**
- Tu URL será algo como: `https://tu-app.up.railway.app`

### 2. Probar la API

```bash
# Health check
curl https://tu-app.up.railway.app/

# Deberías ver:
# {
#   "name": "Power Bank API",
#   "version": "v1",
#   "status": "running"
# }

# API health
curl https://tu-app.up.railway.app/api/v1/health

# Login (después de ejecutar seed)
curl -X POST https://tu-app.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@test.com",
    "password": "SuperAdmin123"
  }'
```

### 3. Actualizar CORS

Regresa a Variables y actualiza `CORS_ORIGINS`:

```env
CORS_ORIGINS=https://tu-frontend.vercel.app,https://tu-app.up.railway.app
```

---

## 🔄 Ejecutar Migraciones y Seeds

Railway ejecuta automáticamente `prisma generate` durante el build, pero necesitas ejecutar las migraciones manualmente la primera vez.

### Opción A: Railway CLI (Recomendado)

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link a tu proyecto
railway link

# Ejecutar migraciones
railway run npm run prisma:deploy

# Crear usuarios de prueba (admin, superadmin, user)
railway run npm run prisma:seed

# Verificar con Prisma Studio
railway run npm run prisma:studio
```

### Opción B: Desde Supabase SQL Editor

Si prefieres, ejecuta las migraciones directamente en Supabase:

1. Copia tu schema SQL generado por Prisma
2. Supabase → SQL Editor → New Query
3. Pega el SQL y ejecuta

---

## 🏗️ Arquitectura del Deploy

```
┌─────────────────────────────────────┐
│  Frontend (Vercel)                  │
│  https://admin.vercel.app           │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Backend (Railway)                  │
│  API + WebSockets                   │
│  https://api.railway.app            │
└──────────┬─────────────┬────────────┘
           │             │
┌──────────▼────────┐   │
│  Supabase         │   │
│  PostgreSQL       │   │
│  Auth & Storage   │   │
└───────────────────┘   │
                        │
           ┌────────────▼──────────┐
           │  WsCharge API         │
           │  Gabinete WebSockets  │
           └───────────────────────┘
```

---

## 📊 Monitoreo y Logs

### Ver Logs en Tiempo Real

**Desde Railway Dashboard:**
1. Ve a tu proyecto → Deployments
2. Click en el deployment activo
3. Verás los logs en tiempo real

**Desde Railway CLI:**
```bash
# Logs en tiempo real
railway logs

# Logs de un deployment específico
railway logs --deployment [id]
```

### Métricas

Railway muestra automáticamente:
- CPU usage
- Memory usage
- Network traffic
- Request count

---

## 🔧 Configuración Avanzada

### Agregar Dominio Personalizado

1. Settings → Networking → Custom Domain
2. Agrega tu dominio (ej: `api.powerbank.com`)
3. Configura los DNS records que Railway te indique:
   ```
   CNAME api.powerbank.com → your-app.up.railway.app
   ```

### Webhooks de Stripe

Después del deploy, configura webhooks:

1. Stripe Dashboard → Developers → Webhooks
2. Agrega endpoint: `https://tu-app.up.railway.app/api/v1/webhooks/stripe`
3. Selecciona eventos necesarios
4. Copia el `Signing secret`
5. Actualiza `STRIPE_WEBHOOK_SECRET` en Railway

### Auto-Deploy desde GitHub

Railway redesplegará automáticamente cuando hagas push a main:

```bash
# Hacer cambios
git add .
git commit -m "Update feature"
git push

# Railway desplegará automáticamente
```

---

## 💾 Base de Datos con Supabase

### Obtener Connection Strings

**En Supabase Dashboard:**
1. Settings → Database
2. Busca **Connection String**
3. Copia:
   - **Connection Pooling** (puerto 6543) → `DATABASE_URL`
   - **Session Mode** (puerto 5432) → `DIRECT_URL`

**⚠️ IMPORTANTE:**
- Usa puerto **6543** (pooling) para queries normales
- Usa puerto **5432** (directo) para migraciones
- Esto es específico de Supabase para optimizar conexiones

### Backups Automáticos

**Plan Free de Supabase:**
- ✅ Backups diarios automáticos (7 días de retención)
- ❌ Point-in-time recovery NO incluido

**Backup Manual:**
```bash
# Desde Railway CLI
railway run -- sh -c 'pg_dump $DATABASE_URL' > backup.sql

# Restore
railway run -- sh -c 'psql $DIRECT_URL' < backup.sql
```

---

## 🆘 Troubleshooting

### Error: "Build failed"

**Ver logs:**
```bash
railway logs
```

**Limpiar y rebuild:**
1. Railway → Settings → Reset Cache
2. Trigger nuevo deploy

### Error: "Database connection failed"

**Verificar variables:**
```bash
railway variables
```

**Prueba de conexión:**
```bash
railway run -- sh -c 'psql $DATABASE_URL -c "SELECT 1;"'
```

**Problemas comunes:**
- ❌ Puerto incorrecto (6543 para DATABASE_URL, 5432 para DIRECT_URL)
- ❌ Password con caracteres especiales sin URL encoding
- ❌ Variables de entorno mal configuradas

### Error: "Prisma migration failed"

**Ejecutar manualmente:**
```bash
railway run npm run prisma:deploy
```

**Si es necesario, reset completo:**
```bash
# ⚠️ CUIDADO: Esto borrará todos los datos
railway run npx prisma migrate reset --force
```

### Error: "WebSocket connection failed"

**Verificar logs:**
```bash
railway logs | grep -i websocket
```

**Desde el cliente, usa:**
- `wss://` (no `ws://`) en producción
- Verifica CORS_ORIGINS incluya tu dominio

### CORS errors desde frontend

**Verificar que `CORS_ORIGINS` contenga el dominio EXACTO:**
```env
# ✅ Correcto
CORS_ORIGINS=https://power-bank-app.vercel.app

# ❌ Incorrecto
CORS_ORIGINS=http://power-bank-app.vercel.app  # http en vez de https
CORS_ORIGINS=https://power-bank-app.vercel.app/  # slash al final
```

---

## 💰 Costos Estimados

### Railway
**Plan Hobby (Free):**
- $5 USD en créditos cada mes
- Suficiente para desarrollo y apps pequeñas

**Uso estimado mensual:**
- Backend API: ~$3-5 USD
- **Total dentro del plan free** 🎉

**Plan Pro ($20/mes):**
- $20 en créditos incluidos
- Más recursos y backups automáticos

### Supabase
**Plan Free:**
- ✅ 500MB database
- ✅ 2GB bandwidth
- ✅ 50,000 monthly active users
- ✅ Backups diarios (7 días)

**COSTO TOTAL INICIAL: ~$3-5/mes**

---

## 📚 Recursos

- [Railway Docs](https://docs.railway.app)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [Supabase Docs](https://supabase.com/docs)
- [Prisma with Railway](https://docs.railway.app/databases/postgresql#using-prisma)
- [WebSocket Support](https://docs.railway.app/reference/websockets)

---

## 🎯 Checklist de Deployment

- [ ] Código en GitHub
- [ ] Proyecto creado en Railway
- [ ] Repositorio conectado
- [ ] Variables de entorno configuradas
- [ ] Build exitoso
- [ ] Migraciones ejecutadas (`railway run npm run prisma:deploy`)
- [ ] Seed ejecutado (`railway run npm run prisma:seed`)
- [ ] Endpoints funcionando
- [ ] WebSockets conectando
- [ ] CORS configurado con dominio del frontend
- [ ] Logs sin errores
- [ ] (Opcional) Dominio personalizado configurado

---

## 🔗 Siguiente Paso

**Después de deployar el backend:**
1. ✅ Obtén tu URL de Railway
2. ✅ Configura CORS con el dominio del frontend
3. ✅ Configura webhooks de Stripe
4. ✅ Prueba conexión desde el emulador de gabinete
5. ✅ Deploy del frontend apuntando a esta API

Ver también:
- [Comparación de plataformas de deployment](options.md)
- [Deployment en Vercel](vercel.md) (alternativa para APIs sin WebSocket)

---

**¿Listo para deployar?** Sigue los 3 pasos de arriba y tendrás tu backend corriendo en minutos.
