// Servicio de monitoreo continuo de gabinetes
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const WSCHARGE_API_URL = 'https://api.w-dian.cn/operate';
const WSCHARGE_OCODE = 'samuelcharge';
const WSCHARGE_USERNAME = 'admin';
const WSCHARGE_PASSWORD = '111111';

let authToken = null;

async function login() {
  try {
    const response = await axios.post(
      `${WSCHARGE_API_URL}/auth/login`,
      { name: WSCHARGE_USERNAME, password: WSCHARGE_PASSWORD },
      { headers: { 'ocode': WSCHARGE_OCODE, 'Content-Type': 'application/json' } }
    );

    if (response.data.code === 1) {
      authToken = response.data.data.token;
      console.log('✅ Autenticado con WsCharge');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error en login:', error.message);
    return false;
  }
}

async function checkCabinets() {
  try {
    // 1. Asegurar autenticación
    if (!authToken) {
      const success = await login();
      if (!success) return;
    }

    // 2. Obtener estado de gabinetes desde WsCharge
    const response = await axios.get(
      `${WSCHARGE_API_URL}/equipment/index`,
      {
        headers: { 'ocode': WSCHARGE_OCODE, 'token': authToken },
        params: { page: 1, limit: 100 }
      }
    );

    if (response.data.code === 1) {
      const cabinets = response.data.data.list || [];

      console.log(`\n⏰ ${new Date().toLocaleTimeString()} - Verificando ${cabinets.length} gabinetes...`);

      for (const cabinet of cabinets) {
        const cabinetId = cabinet.cabinet_id;
        const isOnline = cabinet.is_online === 1;
        const status = isOnline ? 'ONLINE' : 'OFFLINE';

        console.log(`   📦 ${cabinetId}: ${isOnline ? '🟢' : '🔴'} ${status}`);

        // 3. Actualizar en base de datos local
        try {
          const existing = await prisma.cabinet.findUnique({
            where: { id: cabinetId }
          });

          if (existing) {
            await prisma.cabinet.update({
              where: { id: cabinetId },
              data: {
                status: status,
                lastPingAt: isOnline ? new Date() : existing.lastPingAt,
                updatedAt: new Date()
              }
            });
          } else {
            // Crear si no existe
            await prisma.cabinet.create({
              data: {
                id: cabinetId,
                name: `Gabinete ${cabinetId}`,
                status: status,
                location: 'Ubicación por configurar',
                lastPingAt: isOnline ? new Date() : null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
            console.log(`      ✨ Nuevo gabinete agregado`);
          }
        } catch (dbError) {
          console.error(`      ❌ Error BD: ${dbError.message}`);
        }
      }

      console.log(`   ✅ Actualización completada`);
    }

  } catch (error) {
    if (error.response?.status === 401) {
      console.log('🔄 Token expirado, renovando...');
      authToken = null;
      await checkCabinets();
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

async function startMonitoring() {
  console.log('🚀 Iniciando monitoreo de gabinetes...');
  console.log('📡 Consultando WsCharge cada 30 segundos\n');

  // Login inicial
  await login();

  // Verificar inmediatamente
  await checkCabinets();

  // Verificar cada 30 segundos
  setInterval(async () => {
    await checkCabinets();
  }, 30000); // 30 segundos

  console.log('\n💡 El monitor está corriendo. Presiona Ctrl+C para detener.\n');
}

// Manejar cierre graceful
process.on('SIGINT', async () => {
  console.log('\n\n👋 Deteniendo monitor...');
  await prisma.$disconnect();
  process.exit(0);
});

// Iniciar
startMonitoring().catch(console.error);
