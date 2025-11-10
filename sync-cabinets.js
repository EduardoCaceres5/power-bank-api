// Script para sincronizar gabinetes desde WsCharge a la base de datos local
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const WSCHARGE_API_URL = 'https://api.w-dian.cn/operate';
const WSCHARGE_OCODE = 'samuelcharge';
const WSCHARGE_USERNAME = 'admin';
const WSCHARGE_PASSWORD = '111111';

async function syncCabinetsFromWsCharge() {
  console.log('🔄 Sincronizando gabinetes desde WsCharge...\n');

  try {
    // 1. Login
    console.log('📝 Paso 1: Autenticando con WsCharge...');
    const loginResponse = await axios.post(
      `${WSCHARGE_API_URL}/auth/login`,
      {
        name: WSCHARGE_USERNAME,
        password: WSCHARGE_PASSWORD
      },
      {
        headers: {
          'ocode': WSCHARGE_OCODE,
          'Content-Type': 'application/json'
        }
      }
    );

    // WsCharge usa code: 1 para éxito, no 200
    if (loginResponse.data.code !== 1 && loginResponse.data.code !== 200) {
      throw new Error('Login falló: ' + JSON.stringify(loginResponse.data));
    }

    console.log('✅ Autenticación exitosa!');
    console.log(`   Token: ${loginResponse.data.data.token.substring(0, 20)}...`);
    console.log(`   Operador: ${loginResponse.data.data.ocode}\n`);
    const token = loginResponse.data.data.token;

    // 2. Obtener lista de gabinetes
    console.log('📋 Paso 2: Obteniendo gabinetes de WsCharge...');
    const cabinetsResponse = await axios.get(
      `${WSCHARGE_API_URL}/equipment/index`,
      {
        headers: {
          'ocode': WSCHARGE_OCODE,
          'token': token
        },
        params: {
          page: 1,
          limit: 100
        }
      }
    );

    if (cabinetsResponse.data.code !== 1 && cabinetsResponse.data.code !== 200) {
      throw new Error('Error obteniendo gabinetes: ' + JSON.stringify(cabinetsResponse.data));
    }

    const cabinets = cabinetsResponse.data.data.list || [];
    console.log(`✅ Encontrados ${cabinets.length} gabinetes\n`);

    if (cabinets.length === 0) {
      console.log('⚠️  No hay gabinetes en tu cuenta de WsCharge');
      console.log('   Verifica que tu cuenta tenga gabinetes asignados');
      return;
    }

    // 3. Sincronizar cada gabinete con la base de datos
    console.log('💾 Paso 3: Sincronizando con base de datos local...\n');

    for (const cabinet of cabinets) {
      const deviceNumber = cabinet.device_number;
      const isOnline = cabinet.is_online === 1;

      console.log(`\n📦 Procesando: ${deviceNumber}`);
      console.log(`   Estado WsCharge: ${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
      console.log(`   Modelo: ${cabinet.model || 'N/A'}`);
      console.log(`   Ubicación: ${cabinet.address || 'N/A'}`);

      try {
        // Verificar si ya existe
        const existing = await prisma.cabinet.findUnique({
          where: { cabinetId: deviceNumber }
        });

        if (existing) {
          // Actualizar existente
          await prisma.cabinet.update({
            where: { cabinetId: deviceNumber },
            data: {
              status: isOnline ? 'ONLINE' : 'OFFLINE',
              model: cabinet.model || existing.model,
              address: cabinet.address || existing.address,
              location: cabinet.location || existing.location,
              lastPingAt: isOnline ? new Date() : existing.lastPingAt,
              updatedAt: new Date()
            }
          });
          console.log('   ✅ Actualizado en base de datos');
        } else {
          // Crear nuevo
          await prisma.cabinet.create({
            data: {
              cabinetId: deviceNumber,
              name: cabinet.name || `Gabinete ${deviceNumber}`,
              status: isOnline ? 'ONLINE' : 'OFFLINE',
              model: cabinet.model || 'PM8',
              location: cabinet.location || 'Sin ubicación',
              address: cabinet.address,
              latitude: cabinet.latitude ? parseFloat(cabinet.latitude) : null,
              longitude: cabinet.longitude ? parseFloat(cabinet.longitude) : null,
              lastPingAt: isOnline ? new Date() : null,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          console.log('   ✅ Creado en base de datos');
        }

        // Obtener detalles adicionales
        const detailsResponse = await axios.post(
          `${WSCHARGE_API_URL}/equipment/detail`,
          { device_number: deviceNumber },
          {
            headers: {
              'ocode': WSCHARGE_OCODE,
              'token': token,
              'Content-Type': 'application/json'
            }
          }
        );

        if (detailsResponse.data.code === 1 || detailsResponse.data.code === 200) {
          const details = detailsResponse.data.data;
          console.log(`   📊 Detalles:`);
          console.log(`      Señal: ${details.signal || 'N/A'}`);
          console.log(`      Slots: ${details.slot_count || 'N/A'}`);
          console.log(`      Baterías: ${details.battery_count || 'N/A'}`);
        }

      } catch (dbError) {
        console.error(`   ❌ Error guardando en BD: ${dbError.message}`);
      }
    }

    console.log('\n\n✅ Sincronización completada!');
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Abre el admin panel: http://localhost:5173');
    console.log('   2. Ve a la sección "Cabinets"');
    console.log('   3. Deberías ver tus gabinetes con el estado correcto');
    console.log('\n💡 Para actualizar el estado en tiempo real:');
    console.log('   - El gabinete debe enviar heartbeats a tu backend');
    console.log('   - O ejecuta este script periódicamente');

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.response) {
      console.error('Código de estado:', error.response.status);
      console.error('Respuesta:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar sincronización
syncCabinetsFromWsCharge().catch(console.error);
