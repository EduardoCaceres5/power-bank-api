# 🚂 Deploy Railway en 3 Pasos

## ¿Por qué Railway?

✅ **Soporta WebSockets** (necesario para los gabinetes)
✅ **Deploy automático** desde GitHub
✅ **PostgreSQL incluido** (opcional)
✅ **Muy fácil de usar**

## 🚀 Paso 1: Sube a GitHub (si aún no lo has hecho)

```bash
cd c:\Users\ecaceres\proyectos\personal\power-bank-app\backend

git init
git add .
git commit -m "Initial commit - Power Bank Backend"
git branch -M main

# Crea un repo en GitHub y luego:
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

## 🚀 Paso 2: Deploy en Railway

1. **Ve a [railway.app](https://railway.app)**
2. **Sign up / Login** (puedes usar GitHub)
3. **Click "Start a New Project"**
4. **Selecciona "Deploy from GitHub repo"**
5. **Autoriza Railway** para acceder a tus repos
6. **Selecciona tu repositorio** del backend
7. **Railway detectará automáticamente** todo y comenzará el build

## 🚀 Paso 3: Configurar Variables de Entorno

1. **En Railway Dashboard** → Click en tu proyecto
2. **Click "Variables"** (o Settings → Variables)
3. **Click "Raw Editor"** (arriba a la derecha)
4. **Pega esto** (reemplaza los valores si es necesario):

```env
NODE_ENV=production
PORT=3000
API_VERSION=v1

SUPABASE_URL=https://xikzbxjcepmvbenrtslo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa3pieGpjZXBtdmJlbnJ0c2xvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTI0OTYsImV4cCI6MjA3NjIyODQ5Nn0.0TiXORDmhRu65jK4wnDL-C7PFva2hyVyxSaSJJ-V7EQ
SUPABASE_SERVICE_ROLE_KEY=VE-A-SUPABASE-Y-OBTENLO

DATABASE_URL=postgresql://postgres.xikzbxjcepmvbenrtslo:xDQ8n49SNIO2EKyl@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
DIRECT_URL=postgresql://postgres.xikzbxjcepmvbenrtslo:xDQ8n49SNIO2EKyl@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require

STRIPE_SECRET_KEY=sk_test_TU_KEY_AQUI
STRIPE_PUBLISHABLE_KEY=pk_test_TU_KEY_AQUI
STRIPE_WEBHOOK_SECRET=whsec_TU_WEBHOOK

WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=samuelcharge
WSCHARGE_USERNAME=admin
WSCHARGE_PASSWORD=111111
WSCHARGE_SERVICE_ID=tu-service-id
WSCHARGE_TIMEOUT=30000

JWT_SECRET=genera-un-string-super-seguro-aqui-con-openssl-rand-base64-32

# IMPORTANTE: Reemplaza con el dominio real de tu frontend en Vercel
CORS_ORIGINS=https://tu-frontend.vercel.app

LOG_LEVEL=info
```

5. **Click "Update Variables"**
6. **Railway re-desplegará automáticamente**

## ✅ Verificar que Funciona

### 1. Obtén tu URL:
- Railway Dashboard → Settings → Networking → **Generate Domain**
- Tu URL será algo como: `https://tu-app.up.railway.app`

### 2. Prueba la API:
```bash
curl https://tu-app.up.railway.app/
```

Deberías ver:
```json
{
  "name": "Power Bank API",
  "version": "v1",
  "status": "running"
}
```

### 3. Actualiza CORS:
Regresa a Variables y actualiza `CORS_ORIGINS`:
```env
CORS_ORIGINS=https://tu-frontend.vercel.app,https://tu-app.up.railway.app
```

## 🎯 ¡Listo!

Tu backend ya está corriendo en Railway con:
- ✅ WebSockets funcionando
- ✅ API REST disponible
- ✅ Migraciones de base de datos ejecutadas
- ✅ Auto-deploy en cada `git push`

## 📝 Notas Importantes

### Obtener SUPABASE_SERVICE_ROLE_KEY:
1. Ve a [supabase.com](https://supabase.com)
2. Tu proyecto → Settings → API
3. Copia la key que dice `service_role` (no `anon`)

### Generar JWT_SECRET seguro:
```bash
# En tu terminal (Git Bash en Windows)
openssl rand -base64 32
```

### Ver Logs:
- Railway Dashboard → Click en tu deployment → Ver logs en tiempo real

### Costos:
- Railway da $5 gratis al mes
- Tu app probablemente usará ~$2-5/mes
- Si se acaba el crédito, la app se pausa hasta el siguiente mes

## 📚 Documentación Completa

Para más detalles, webhooks, dominios custom, etc., ve a:
- **[RAILWAY-DEPLOY.md](RAILWAY-DEPLOY.md)** - Guía completa

## 🆘 Problemas Comunes

**Build falla:**
- Revisa logs en Railway Dashboard
- Asegúrate de que todas las variables estén configuradas

**WebSocket no conecta:**
- Usa `wss://` (no `ws://`) en producción
- Verifica CORS_ORIGINS

**Prisma errors:**
- Asegúrate de que `DATABASE_URL` esté bien configurada
- Las migraciones se ejecutan automáticamente al iniciar

**CORS errors al hacer login desde frontend:**
- Verifica que `CORS_ORIGINS` contenga el dominio EXACTO de tu frontend
- Ejemplo: `CORS_ORIGINS=https://power-bank-app.vercel.app`
- NO uses `http://` en producción, debe ser `https://`
- NO agregues slash al final: `https://ejemplo.com` ✅ | `https://ejemplo.com/` ❌

---

**¿Siguiente paso?** Configura tu frontend para usar la URL de Railway y prueba todo end-to-end!
