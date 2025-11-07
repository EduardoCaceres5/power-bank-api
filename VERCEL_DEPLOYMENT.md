# 🚀 Guía de Despliegue en Vercel

Esta guía te ayudará a desplegar tu backend de Power Bank en Vercel.

## ⚠️ Limitaciones de Vercel para este Proyecto

**IMPORTANTE**: Vercel tiene algunas limitaciones que afectan este proyecto:

1. **WebSockets**: Vercel **NO soporta WebSockets de forma nativa** en serverless functions
   - Tu aplicación usa `socket.io` para comunicación con los gabinetes WsCharge
   - **Solución**: Necesitarás desplegar la funcionalidad de WebSocket en otro servicio (Railway, Render, Heroku, o un VPS)

2. **Serverless Functions**: Vercel usa funciones serverless que tienen:
   - Timeout de 10 segundos (plan hobby) o hasta 300s (plan pro)
   - Ejecución stateless (no mantienen estado entre requests)

3. **Base de Datos**: Necesitarás una base de datos PostgreSQL externa

## 🔄 Alternativas Recomendadas

Dado que tu aplicación necesita WebSockets, te recomiendo:

### Opción 1: Railway (Recomendado) ✅
- ✅ Soporta WebSockets
- ✅ PostgreSQL incluido
- ✅ Deploy desde GitHub
- ✅ Plan gratuito disponible
- 🔗 [Railway.app](https://railway.app)

### Opción 2: Render
- ✅ Soporta WebSockets
- ✅ PostgreSQL gratuito
- ✅ Deploy desde GitHub
- 🔗 [Render.com](https://render.com)

### Opción 3: Arquitectura Híbrida
- API REST en Vercel (endpoints HTTP)
- WebSocket server en Railway/Render
- Base de datos compartida

---

## 📝 Si Aún Así Quieres Usar Vercel (Solo para API REST)

Si decides usar Vercel solo para los endpoints REST (sin WebSockets), aquí están los pasos:

### 1. Preparar Base de Datos

Necesitas una base de datos PostgreSQL. Opciones:

**Supabase** (Ya la estás usando):
```bash
# Ya tienes configurado DATABASE_URL y DIRECT_URL
```

**Vercel Postgres**:
```bash
vercel postgres create
```

**Neon** (Recomendado):
```bash
# Crea una cuenta en https://neon.tech
# Copia la connection string
```

### 2. Configurar Variables de Entorno en Vercel

Ve a tu proyecto en Vercel → Settings → Environment Variables y agrega:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
DIRECT_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# JWT
JWT_SECRET=your-super-secret-jwt-key
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
CORS_ORIGINS=https://your-frontend.vercel.app
```

### 3. Instalar Vercel CLI

```bash
npm i -g vercel
```

### 4. Login en Vercel

```bash
vercel login
```

### 5. Deploy

**Opción A: Desde la CLI**
```bash
# Ir al directorio del backend
cd C:\Users\ecaceres\proyectos\personal\power-bank-app\backend

# Primera vez (modo interactivo)
vercel

# Siguientes deploys
vercel --prod
```

**Opción B: Desde GitHub (Recomendado)**

1. Sube tu código a GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/tu-usuario/power-bank-backend.git
git push -u origin main
```

2. Importa el proyecto en Vercel:
   - Ve a [vercel.com](https://vercel.com)
   - Click en "New Project"
   - Importa tu repositorio
   - Configura las variables de entorno
   - Deploy

### 6. Ejecutar Migraciones

Después del primer deploy:

```bash
# Usando Vercel CLI
vercel env pull .env.production
npm run prisma:deploy
```

O configura el script `vercel-build` que ejecutará automáticamente las migraciones.

---

## 🔧 Archivos de Configuración Creados

### `vercel.json`
```json
{
  "version": 2,
  "name": "power-bank-api",
  "builds": [
    {
      "src": "src/server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "regions": ["iad1"]
}
```

### `.vercelignore`
Ignora archivos innecesarios para el deploy.

### `package.json` (actualizado)
- `build`: Genera Prisma client y compila TypeScript
- `vercel-build`: Ejecuta migraciones en Vercel

---

## ⚙️ Modificaciones Necesarias para Vercel

Si decides usar Vercel sin WebSockets, necesitas:

### 1. Desactivar WebSocket en producción

Crea `src/server.vercel.ts`:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger, morganStream } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import routes from './routes';

const app = express();
const API_VERSION = process.env.API_VERSION || 'v1';

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: morganStream }));

// Routes
app.get('/', (req, res) => {
  res.json({
    name: 'Power Bank API',
    version: API_VERSION,
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

app.use(`/api/${API_VERSION}`, routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
```

Actualiza `vercel.json`:
```json
{
  "builds": [
    {
      "src": "src/server.vercel.ts",
      "use": "@vercel/node"
    }
  ]
}
```

---

## 🧪 Testing del Deploy

Después de deployar, prueba:

```bash
# Health check
curl https://your-app.vercel.app/

# API endpoints
curl https://your-app.vercel.app/api/v1/health

# Auth
curl -X POST https://your-app.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin123"}'
```

---

## 📊 Monitoreo

Vercel proporciona:
- Logs en tiempo real
- Analytics de performance
- Error tracking
- Métricas de uso

Accede desde el dashboard de Vercel.

---

## 🚨 Troubleshooting

### Error: "Module not found: prisma"
```bash
# Asegúrate de que prisma esté en dependencies, no en devDependencies
npm install --save prisma @prisma/client
```

### Error: "Cannot find module"
```bash
# Verifica que tsconfig.json tenga la configuración correcta
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Error: Database connection failed
- Verifica que DATABASE_URL esté correctamente configurada
- Asegúrate de que la DB acepte conexiones desde cualquier IP
- Usa DIRECT_URL para migraciones en Vercel

---

## 💡 Recomendación Final

**Para este proyecto específico**, te recomiendo usar **Railway** en lugar de Vercel porque:

1. ✅ Soporta WebSockets nativamente (necesario para WsCharge)
2. ✅ Incluye PostgreSQL gratis
3. ✅ Deploy desde GitHub automático
4. ✅ Logs en tiempo real
5. ✅ No requiere modificaciones en el código

¿Quieres que te ayude a configurar el deploy en Railway en su lugar?
