# 🚂 Guía de Despliegue en Railway (Recomendado)

Railway es la mejor opción para este proyecto porque **soporta WebSockets** y tiene PostgreSQL integrado.

## ✅ Ventajas de Railway

- ✅ **WebSockets soportados** (necesario para WsCharge)
- ✅ **PostgreSQL incluido** (gratis hasta 5GB)
- ✅ **Deploy desde GitHub** automático
- ✅ **$5 USD gratis** cada mes
- ✅ **Logs en tiempo real**
- ✅ **Sin configuración compleja**

---

## 🚀 Pasos para Desplegar

### 1. Crear Cuenta en Railway

1. Ve a [railway.app](https://railway.app)
2. Click en "Start a New Project"
3. Autoriza con GitHub

### 2. Crear Base de Datos PostgreSQL

1. En Railway, click en "New Project"
2. Click en "+ New"
3. Selecciona "Database" → "PostgreSQL"
4. Railway creará automáticamente una base de datos

### 3. Subir Código a GitHub

```bash
cd C:\Users\ecaceres\proyectos\personal\power-bank-app\backend

# Inicializar Git (si no lo has hecho)
git init

# Crear .gitignore si no existe
echo "node_modules
dist
.env
.env.local
*.log
logs
coverage" > .gitignore

# Commit
git add .
git commit -m "Initial commit - Power Bank Backend"

# Crear repo en GitHub y pushear
git branch -M main
git remote add origin https://github.com/TU-USUARIO/power-bank-backend.git
git push -u origin main
```

### 4. Conectar Repositorio a Railway

1. En Railway, click en "+ New"
2. Selecciona "GitHub Repo"
3. Busca y selecciona tu repositorio `power-bank-backend`
4. Railway detectará automáticamente que es un proyecto Node.js

### 5. Configurar Variables de Entorno

En Railway, ve a tu servicio → Variables y agrega:

#### Database (Auto-generadas por Railway)
Railway ya configura automáticamente:
- `DATABASE_URL` - Conexión a PostgreSQL
- `DATABASE_PRIVATE_URL` - Conexión interna

**Debes agregar manualmente:**

```env
# Database Direct URL (usa el mismo que DATABASE_URL)
DIRECT_URL=${{DATABASE_URL}}

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# JWT
JWT_SECRET=genera-una-clave-secreta-segura-aqui
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# WsCharge API
WSCHARGE_API_URL=https://api.w-dian.cn/operate
WSCHARGE_OCODE=your-ocode
WSCHARGE_USERNAME=your-username
WSCHARGE_PASSWORD=your-password

# App
NODE_ENV=production
PORT=3000
API_VERSION=v1
CORS_ORIGINS=https://your-frontend-domain.com,https://your-admin-panel.com
```

**Tip**: Puedes usar variables de Railway con sintaxis `${{VARIABLE}}`:
```env
DIRECT_URL=${{DATABASE_URL}}
```

### 6. Configurar Build Commands

Railway detecta automáticamente el `package.json`, pero puedes personalizar:

**Settings → Deploy:**
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

### 7. Deploy

Railway desplegará automáticamente cuando:
- Hagas push a GitHub
- Cambies variables de entorno
- Hagas redeploy manual

**Primera vez:**
1. Railway detectará el proyecto
2. Instalará dependencias
3. Ejecutará `npm run build` (que incluye `prisma generate`)
4. Ejecutará las migraciones automáticamente
5. Iniciará el servidor con `npm start`

### 8. Ejecutar Migraciones

Railway ejecuta automáticamente el script `vercel-build` si existe. Ya lo tienes configurado:

```json
"vercel-build": "prisma generate && prisma migrate deploy"
```

Pero Railway prefiere usar `build`. Vamos a actualizar:

**En `package.json`**, el script `build` ya está bien:
```json
"build": "prisma generate && tsc"
```

**Para ejecutar migraciones**, necesitas crear un script adicional. Railway buscará:
1. `railway.json` ✅ (Ya creado)
2. O configurar en Settings

**Opción 1: Automático con Prisma**

Railway ejecutará las migraciones automáticamente si detecta Prisma. Asegúrate de que tu schema esté en `prisma/schema.prisma` ✅

**Opción 2: Manual desde Railway CLI**

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link proyecto
railway link

# Ejecutar comando
railway run npm run prisma:deploy
```

### 9. Obtener URL del Deploy

Railway te dará una URL como:
```
https://power-bank-backend-production.up.railway.app
```

Puedes:
- Usar esta URL
- Agregar un dominio personalizado en Settings → Networking

---

## 🔄 Auto-Deploy desde GitHub

Railway redesplegará automáticamente cuando hagas push a main:

```bash
# Hacer cambios
git add .
git commit -m "Update cabinet management"
git push

# Railway desplegará automáticamente
```

---

## 📊 Monitoreo

### Ver Logs en Tiempo Real

1. Ve a tu proyecto en Railway
2. Click en "Deployments"
3. Click en el deploy activo
4. Verás logs en tiempo real

### Métricas

Railway muestra:
- CPU usage
- Memory usage
- Network traffic
- Request count

---

## 💾 Base de Datos

### Conectarse a PostgreSQL

**Desde Railway Dashboard:**
1. Click en tu database PostgreSQL
2. Ve a "Data" para ver las tablas
3. O usa "Connect" para obtener credenciales

**Desde Prisma Studio localmente:**
```bash
# Conectar a la DB de producción
railway run npx prisma studio
```

**Desde cliente PostgreSQL:**
```bash
# Railway te da la connection string
psql $DATABASE_URL
```

### Backups

Railway hace backups automáticos en el plan Pro. En el plan free:

```bash
# Backup manual
railway run pg_dump $DATABASE_URL > backup.sql

# Restore
railway run psql $DATABASE_URL < backup.sql
```

---

## 🔧 Configuración Avanzada

### Agregar Dominio Personalizado

1. Settings → Networking → Custom Domain
2. Agrega tu dominio (ej: `api.powerbank.com`)
3. Configura los DNS records que Railway te indique:
   ```
   CNAME api.powerbank.com → your-app.up.railway.app
   ```

### WebSocket Configuration

Ya está configurado automáticamente. Railway soporta WebSockets en la misma URL:

```javascript
// Cliente WebSocket
const socket = io('https://your-app.up.railway.app');
```

### Health Checks

Railway hace health checks automáticamente. Tu endpoint `/` responde correctamente:

```typescript
app.get('/', (req, res) => {
  res.json({
    name: 'Power Bank API',
    version: API_VERSION,
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});
```

---

## 🧪 Testing

Después del deploy, prueba:

```bash
# Obtener tu URL de Railway
RAILWAY_URL="https://your-app.up.railway.app"

# Health check
curl $RAILWAY_URL/

# API health
curl $RAILWAY_URL/api/v1/health

# Login de prueba
curl -X POST $RAILWAY_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Admin123"
  }'

# Test WebSocket (desde el browser console)
const socket = io('https://your-app.up.railway.app');
socket.on('connect', () => console.log('Connected!'));
```

---

## 💰 Costos

**Plan Hobby (Free):**
- $5 USD en créditos cada mes
- PostgreSQL hasta 5GB
- Suficiente para desarrollo y producción pequeña

**Plan Pro ($20/mes):**
- $20 en créditos incluidos
- Más recursos
- Backups automáticos
- Soporte prioritario

**Estimación de uso mensual (aprox):**
- API Backend: ~$3-5 USD
- PostgreSQL: Gratis hasta 5GB
- **Total: ~$3-5 USD/mes** (dentro del plan free)

---

## 🚨 Troubleshooting

### Error: "Build failed"

**Ver logs:**
```bash
railway logs
```

**Soluciones comunes:**
```bash
# Limpiar caché
railway run npm clean-install

# Verificar que TypeScript compile
npm run build
```

### Error: "Database connection failed"

**Verificar variables:**
```bash
railway variables
```

**Asegúrate de tener:**
- `DATABASE_URL` (auto-generada)
- `DIRECT_URL` apuntando a `${{DATABASE_URL}}`

### Error: "Prisma migration failed"

**Ejecutar manualmente:**
```bash
railway run npm run prisma:deploy
```

### Error: "Port already in use"

Railway asigna el puerto automáticamente. Tu código ya lo maneja:
```typescript
const PORT = process.env.PORT || 3000;
```

---

## 📚 Recursos

- [Railway Docs](https://docs.railway.app)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [Prisma with Railway](https://docs.railway.app/databases/postgresql#using-prisma)
- [WebSocket Support](https://docs.railway.app/reference/websockets)

---

## 🎯 Checklist de Deployment

- [ ] Código en GitHub
- [ ] Proyecto creado en Railway
- [ ] PostgreSQL agregado al proyecto
- [ ] Repositorio conectado
- [ ] Variables de entorno configuradas
- [ ] Build exitoso
- [ ] Migraciones ejecutadas
- [ ] Endpoints funcionando
- [ ] WebSockets conectando
- [ ] Logs sin errores
- [ ] Dominio personalizado (opcional)

---

## 🚀 Deploy Rápido (TL;DR)

```bash
# 1. Push a GitHub
git add .
git commit -m "Ready for Railway"
git push

# 2. En Railway:
- New Project → GitHub Repo → Select repo
- Add PostgreSQL
- Add environment variables
- Deploy automáticamente

# 3. Verificar
curl https://your-app.up.railway.app/api/v1/health
```

---

¿Necesitas ayuda con algún paso específico?
