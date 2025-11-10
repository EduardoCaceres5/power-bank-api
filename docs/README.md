# Documentación del Backend - Power Bank App

Documentación completa del backend de la aplicación de alquiler de power banks con integración WsCharge.

## 📚 Índice de Documentación

### 🚀 Getting Started

Para comenzar, lee el [README principal](../README.md) que contiene:
- Instalación y configuración
- Scripts disponibles
- Estructura del proyecto
- Primeros pasos

### 📡 API

- **[Endpoints](api/endpoints.md)** - Documentación completa de todos los endpoints REST
- **[WsCharge API](api/wscharge.md)** - Integración con la API de WsCharge para control de gabinetes

### 📖 Guías

- **[Autenticación](guides/authentication.md)** - Sistema de autenticación JWT, roles y permisos
- **[Integración de Dispositivos](guides/device-integration.md)** - Cómo conectar gabinetes y manejar heartbeats
- **[Configuración del Gabinete Físico](guides/cabinet-physical-setup.md)** - ⭐ **NUEVO** - Guía completa para configurar el gabinete PM8 físico
- **[Rate Limiting](guides/rate-limiting.md)** - Configuración de límites de tasa para protección de API

### 🌐 Deployment

- **[Railway](deployment/railway.md)** - ⭐ **Recomendado** - Deploy completo con WebSockets
- **[Vercel](deployment/vercel.md)** - Alternativa para APIs sin WebSocket
- **[Comparación de Opciones](deployment/options.md)** - Comparativa de plataformas (Railway, Vercel, Render, etc.)
- **[Guía General](deployment/general.md)** - Conceptos generales de deployment

### 🔧 Troubleshooting

- **[Autenticación WsCharge](troubleshooting/wscharge-auth.md)** - Solución de problemas con tokens y autenticación
- **[Notas de Implementación](troubleshooting/implementation-notes.md)** - Resumen de implementación y decisiones técnicas

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────┐
│  Frontend Admin (Vercel)            │
│  React + TypeScript + Tailwind      │
└──────────────┬──────────────────────┘
               │ HTTPS/WSS
┌──────────────▼──────────────────────┐
│  Backend API (Railway)              │
│  Express + Socket.IO + Prisma       │
│  - REST API                         │
│  - WebSocket para gabinetes         │
│  - Autenticación JWT                │
│  - Rate limiting                    │
└──────────┬─────────────┬────────────┘
           │             │
┌──────────▼────────┐   │
│  Supabase         │   │
│  - PostgreSQL     │   │
│  - Auth (backup)  │   │
└───────────────────┘   │
                        │
           ┌────────────▼──────────┐
           │  WsCharge API         │
           │  - Control cabinets   │
           │  - Slots management   │
           └───────────────────────┘
```

## 🔑 Características Principales

### Autenticación y Autorización
- Sistema JWT con refresh tokens
- 4 niveles de roles: `user`, `operator`, `admin`, `superadmin`
- Rate limiting por rol para protección contra abuso
- Middleware de autenticación y autorización

### Gestión de Gabinetes
- Conexión WebSocket en tiempo real
- Sistema de heartbeat para monitoreo
- Auto-reconexión de dispositivos
- Integración completa con WsCharge API

### Alquileres
- Sistema completo de alquiler de power banks
- Cálculo de tarifas y depósitos
- Estados: `active`, `completed`, `overdue`
- Integración con Stripe para pagos

### Monitoreo y Logs
- Winston logger con niveles configurables
- Logs en archivos rotativos
- Métricas de salud del sistema
- Monitoreo de conexiones de dispositivos

## 🛠️ Stack Tecnológico

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **WebSockets**: Socket.IO
- **ORM**: Prisma
- **Base de Datos**: PostgreSQL (Supabase)
- **Autenticación**: JWT + bcrypt
- **Pagos**: Stripe
- **Logging**: Winston
- **Validación**: Zod
- **Seguridad**: Helmet, CORS, Rate Limiting

## 📝 Convenciones de Código

### Estructura de Archivos
```
src/
├── controllers/     # Controladores de rutas
├── services/        # Lógica de negocio
├── routes/          # Definición de rutas
├── middleware/      # Middlewares (auth, rate-limit, etc.)
├── lib/             # Utilidades y configuraciones (Prisma, Stripe, etc.)
├── types/           # Tipos TypeScript
└── utils/           # Helpers y funciones utilitarias
```

### Estándares
- TypeScript estricto
- ESLint + Prettier para code formatting
- Async/await para operaciones asíncronas
- Manejo de errores centralizado
- Logging consistente

## 🔐 Seguridad

- Validación de entrada con Zod
- Sanitización de datos
- Rate limiting por endpoint
- Headers de seguridad con Helmet
- CORS configurado
- Secrets en variables de entorno
- Bcrypt para hash de passwords
- JWT con expiración

## 📊 Scripts Útiles

```bash
# Desarrollo
npm run dev                    # Servidor con hot-reload

# Build y Deploy
npm run build                  # Compilar TypeScript
npm start                      # Servidor producción

# Base de Datos
npm run prisma:generate        # Generar Prisma Client
npm run prisma:migrate         # Crear migración
npm run prisma:studio          # Abrir Prisma Studio
npm run prisma:seed            # Seed de datos iniciales

# Dispositivos (Testing)
npm run emulate:cabinet        # Emular gabinete WebSocket
npm run test:device            # Test de heartbeat
npm run setup:cabinet          # Configurar gabinete
```

## 🤝 Contribución

Para contribuir al proyecto:
1. Sigue las convenciones de código establecidas
2. Escribe tests para nuevas funcionalidades
3. Actualiza la documentación correspondiente
4. Usa commits descriptivos

## 📞 Soporte

Si encuentras problemas:
1. Revisa la sección de [Troubleshooting](troubleshooting/)
2. Verifica los logs con `railway logs` o localmente en `logs/`
3. Consulta la documentación de las APIs externas (WsCharge, Stripe)

---

**Última actualización**: Noviembre 2025
