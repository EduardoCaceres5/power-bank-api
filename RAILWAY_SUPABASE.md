# 🚂 Guía de Despliegue en Railway con Supabase

Configuración para desplegar el backend en Railway usando Supabase como base de datos.

## 🏗️ Arquitectura

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

## ✅ Ventajas de Railway + Supabase

- ✅ **Railway**: WebSockets, deploy automático, logs en tiempo real
- ✅ **Supabase**: PostgreSQL gratis (hasta 500MB), Auth integrado, backups automáticos
- ✅ **Costo**: $3-5/mes total (Railway) + $0 (Supabase free tier)

---

## 📋 Pre-requisitos

### 1. Base de Datos en Supabase

Ya deberías tener:
- ✅ Proyecto creado en [supabase.com](https://supabase.com)
- ✅ Database configurada
- ✅ Connection strings obtenidas

Si no, aquí está cómo obtener las connection strings:

**En Supabase Dashboard:**
1. Ve a **Settings** → **Database**
2. Busca **Connection String**
3. Copia:
   - **Connection Pooling** (para `DATABASE_URL`) - puerto 6543
   - **Session Mode** (para `DIRECT_URL`) - puerto 5432

Ejemplo:
```env
# Connection Pooling (Transaction mode) - para queries normales
DATABASE_URL=postgresql://postgres.xxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Direct Connection (Session mode) - para migraciones
DIRECT_URL=postgresql://postgres.xxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

### 2. Cuenta en Railway

Crea una cuenta en [railway.app](https://railway.app) con GitHub.

---

## 🚀 Pasos de Despliegue

### 1. Preparar Código en GitHub

```bash
cd C:\Users\ecaceres\proyectos\personal\power-bank-app\backend

# Verificar .gitignore
cat .gitignore
# Debe incluir:
# node_modules
# dist
# .env
# .env.local
# *.log

# Git init y push
git init
git add .
git commit -m "Backend ready for Railway with Supabase"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/power-bank-backend.git
git push -u origin main
```

### 2. Crear Proyecto en Railway

1. Ve a [railway.app](https://railway.app)
2. Click **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Autoriza Railway a acceder a tu GitHub
5. Selecciona el repositorio `power-bank-backend`

**Railway detectará automáticamente:**
- Node.js project
- Build command: `npm run build`
- Start command: `npm start`

### 3. Configurar Variables de Entorno

En Railway → Tu proyecto → Variables, agrega todas estas variables:

#### Database (Supabase)

```env
# Supabase Database URLs
DATABASE_URL=postgresql://postgres.xxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.xxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres

# Supabase Auth
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANTE**:
- Usa el puerto **6543** (pooling) para `DATABASE_URL`
- Usa el puerto **5432** (directo) para `DIRECT_URL`
- Esto es específico de Supabase para optimizar conexiones

#### JWT

```env
JWT_SECRET=genera-una-clave-super-secreta-aqui-minimo-32-caracteres
JWT_EXPIRES_IN=7d
```

**Generar JWT_SECRET:**
```bash
# En tu terminal local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Stripe

```env
STRIPE_SECRET_KEY=sk_test_51xxx...
STRIPE_PUBLISHABLE_KEY=pk_test_51xxx...
STRIPE_WEBHOOK_SECRET=whsec_xxx...
```

#### WsCharge API

```env
WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=tu-operator-code
WSCHARGE_USERNAME=tu-username
WSCHARGE_PASSWORD=tu-password
```

#### App Configuration

```env
NODE_ENV=production
PORT=3000
API_VERSION=v1
LOG_LEVEL=info
```

#### CORS (Actualizarás después del deploy del frontend)

```env
CORS_ORIGINS=http://localhost:5173
```

### 4. Deploy

Railway desplegará automáticamente cuando:
1. Detecte el repositorio
2. Instale dependencias (`npm install`)
3. Ejecute build (`npm run build` → incluye `prisma generate`)
4. Inicie el servidor (`npm start`)

**Monitorear el deploy:**
- Railway → Deployments → View Logs
- Verás el progreso en tiempo real

### 5. Ejecutar Migraciones de Prisma

Railway ejecutará automáticamente `prisma generate` durante el build, pero necesitas ejecutar las migraciones.

**Opción A: Automático con script de build**

El script `vercel-build` en tu `package.json` ya incluye `prisma migrate deploy`:

```json
"vercel-build": "prisma generate && prisma migrate deploy"
```

Railway ejecutará esto automáticamente si lo detecta.

**Opción B: Manual desde Railway CLI**

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link a tu proyecto
railway link

# Ejecutar migraciones
railway run npm run prisma:deploy

# O ejecutar seed (crear usuarios admin)
railway run npm run prisma:seed
```

**Opción C: Desde Supabase SQL Editor**

Si prefieres, puedes ejecutar las migraciones directamente en Supabase:

1. Copia tu schema SQL generado por Prisma
2. Supabase → SQL Editor → New Query
3. Pega el SQL y ejecuta

### 6. Verificar el Deploy

Railway te dará una URL como:
```
https://power-bank-backend-production.up.railway.app
```

**Probar endpoints:**

```bash
# Health check
curl https://tu-app.up.railway.app/

# API health
curl https://tu-app.up.railway.app/api/v1/health

# Login (si ya ejecutaste seed)
curl -X POST https://tu-app.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@test.com",
    "password": "SuperAdmin123"
  }'
```

### 7. Configurar Dominio Personalizado (Opcional)

1. Railway → Settings → Networking
2. Click **"Generate Domain"** (gratis) → `your-app.up.railway.app`
3. O agrega **"Custom Domain"**:
   - Ingresa: `api.tudominio.com`
   - Configura DNS CNAME:
     ```
     CNAME api.tudominio.com → your-app.up.railway.app
     ```

### 8. Actualizar CORS con URL del Frontend

Después de desplegar el frontend en Vercel, actualiza:

```env
CORS_ORIGINS=https://tu-admin.vercel.app,https://*.vercel.app
```

Railway redesplegará automáticamente.

---

## 🔄 Ejecutar Migrations y Seeds

### Primera vez (después del deploy):

```bash
# Conectar a Railway
railway link

# Ejecutar migraciones
railway run npm run prisma:deploy

# Crear usuarios de prueba (admin, superadmin, user)
railway run npm run prisma:seed

# Verificar que funcionó
railway run npm run prisma:studio
# Abrirá Prisma Studio conectado a Supabase
```

### Cuando agregues nuevas migraciones:

```bash
# Desarrollo local
npm run prisma:migrate

# Commit y push
git add prisma/migrations
git commit -m "Add new migration"
git push

# Railway desplegará automáticamente
# Las migraciones se aplicarán automáticamente si configuraste vercel-build
```

---

## 📊 Monitoreo y Logs

### Ver Logs en Tiempo Real

**Desde Railway Dashboard:**
1. Railway → Tu proyecto → Deployments
2. Click en el deployment activo
3. View Logs

**Desde Railway CLI:**
```bash
railway logs
```

### Métricas de Supabase

**En Supabase Dashboard:**
1. Database → Usage
2. Monitorea:
   - Tamaño de la DB
   - Conexiones activas
   - Query performance

**Database Health:**
```sql
-- En Supabase SQL Editor
SELECT * FROM pg_stat_database WHERE datname = 'postgres';
SELECT count(*) FROM pg_stat_activity;
```

---

## 💾 Backups de Base de Datos

### Supabase (Automático)

**Plan Free:**
- Backups diarios automáticos (7 días de retención)
- Point-in-time recovery NO incluido

**Plan Pro ($25/mes):**
- Backups diarios automáticos (30 días)
- Point-in-time recovery

### Backup Manual

```bash
# Desde Railway CLI
railway run -- sh -c 'pg_dump $DATABASE_URL' > backup.sql

# O desde local (usando DIRECT_URL de Supabase)
pg_dump "postgresql://postgres.xxx:PASSWORD@...supabase.com:5432/postgres" > backup.sql
```

### Restore

```bash
# Desde Railway
railway run -- sh -c 'psql $DIRECT_URL' < backup.sql

# O desde Supabase SQL Editor (copiar/pegar SQL)
```

---

## 🔧 Troubleshooting

### Error: "Database connection failed"

**Verificar connection strings:**
```bash
railway variables
```

**Prueba de conexión:**
```bash
# Desde Railway
railway run -- sh -c 'psql $DATABASE_URL -c "SELECT 1;"'
```

**Problemas comunes:**
- ❌ Puerto incorrecto (debe ser 6543 para DATABASE_URL, 5432 para DIRECT_URL)
- ❌ Password con caracteres especiales (debe estar URL-encoded)
- ❌ IP no permitida (Supabase permite todas por defecto)

### Error: "Too many database connections"

**Causa:** Supabase free tier tiene límite de conexiones

**Solución:**
```typescript
// En src/lib/prisma.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Limitar conexiones en producción
  pool: {
    max: 5,  // Reducir para Supabase free tier
    timeout: 30000,
  },
});
```

### Error: "Prisma migration failed"

**Opción 1: Ejecutar manualmente**
```bash
railway run npm run prisma:deploy
```

**Opción 2: Reset y migrar**
```bash
# ⚠️ CUIDADO: Esto borrará todos los datos
railway run npx prisma migrate reset --force
```

### Error: "WebSocket connection failed"

**Verificar que Railway está corriendo:**
```bash
railway status
```

**Verificar logs:**
```bash
railway logs | grep -i websocket
```

### Build failed en Railway

**Ver logs detallados:**
```bash
railway logs --deployment [deployment-id]
```

**Limpiar y rebuild:**
1. Railway → Settings → Reset Cache
2. Trigger nuevo deploy

---

## 💰 Costos

### Railway
**Plan Hobby:**
- $5 USD en créditos cada mes
- Uso estimado del backend: ~$3-5/mes

### Supabase
**Plan Free:**
- ✅ 500MB de database (suficiente para comenzar)
- ✅ 2GB de bandwidth
- ✅ 50,000 monthly active users
- ✅ Backups diarios (7 días)

**Cuándo actualizar a Pro ($25/mes):**
- DB > 500MB
- Necesitas point-in-time recovery
- Más de 50k usuarios activos

**COSTO TOTAL INICIAL: ~$3-5/mes** 🎉

---

## 📚 Recursos

- [Railway Docs](https://docs.railway.app)
- [Supabase Docs](https://supabase.com/docs)
- [Prisma with Supabase](https://www.prisma.io/docs/guides/database/supabase)
- [Railway CLI](https://docs.railway.app/develop/cli)

---

## 🎯 Checklist de Deployment

- [ ] Supabase project creado
- [ ] Database connection strings obtenidas
- [ ] Código en GitHub
- [ ] Proyecto creado en Railway
- [ ] Repositorio conectado a Railway
- [ ] Variables de entorno configuradas
- [ ] Build exitoso en Railway
- [ ] Migraciones ejecutadas
- [ ] Seed ejecutado (usuarios admin creados)
- [ ] Endpoints funcionando
- [ ] WebSockets conectando
- [ ] CORS configurado
- [ ] Logs sin errores

---

## 🚀 Deploy Rápido (TL;DR)

```bash
# 1. Push a GitHub
cd backend
git add .
git commit -m "Ready for Railway"
git push

# 2. En Railway:
# - New Project → GitHub Repo
# - Add environment variables (Supabase URLs, etc.)
# - Deploy automáticamente

# 3. Ejecutar migraciones
railway link
railway run npm run prisma:deploy
railway run npm run prisma:seed

# 4. Verificar
curl https://your-app.up.railway.app/api/v1/health
```

---

## 🔗 Próximo Paso

Después de desplegar el backend, continúa con el frontend:
- Ver [admin/VERCEL_DEPLOYMENT.md](../admin/VERCEL_DEPLOYMENT.md)

---

¿Necesitas ayuda con algún paso específico? 🚀
