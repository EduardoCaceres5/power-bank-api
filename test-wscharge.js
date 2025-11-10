// Script de prueba para verificar conexión con WsCharge
const axios = require('axios');

const WSCHARGE_API_URL = 'https://api.w-dian.cn/operate';
const WSCHARGE_OCODE = 'samuelcharge';
const WSCHARGE_USERNAME = 'admin';
const WSCHARGE_PASSWORD = '111111';

async function testWsChargeConnection() {
  console.log('🔍 Probando conexión con WsCharge...\n');

  try {
    // 1. Login
    console.log('📝 Paso 1: Intentando login...');
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

    if (loginResponse.data.code === 200) {
      console.log('✅ Login exitoso!');
      console.log('Token:', loginResponse.data.data.token.substring(0, 30) + '...');

      const token = loginResponse.data.data.token;

      // 2. Obtener lista de gabinetes
      console.log('\n📋 Paso 2: Obteniendo lista de gabinetes...');
      const cabinetsResponse = await axios.get(
        `${WSCHARGE_API_URL}/equipment/index`,
        {
          headers: {
            'ocode': WSCHARGE_OCODE,
            'token': token
          },
          params: {
            page: 1,
            limit: 10
          }
        }
      );

      if (cabinetsResponse.data.code === 200) {
        console.log('✅ Gabinetes obtenidos exitosamente!');
        console.log('\n📊 Gabinetes encontrados:');

        const cabinets = cabinetsResponse.data.data.list || [];

        if (cabinets.length === 0) {
          console.log('⚠️  No hay gabinetes registrados en tu cuenta de WsCharge');
          console.log('\n💡 Solución:');
          console.log('   1. Verifica que tu cuenta tenga gabinetes asignados');
          console.log('   2. Contacta a WsCharge para obtener acceso a gabinetes');
          console.log('   3. O registra un gabinete manualmente en tu sistema');
        } else {
          cabinets.forEach((cabinet, index) => {
            console.log(`\n  ${index + 1}. ${cabinet.device_number || cabinet.name}`);
            console.log(`     Estado: ${cabinet.is_online === 1 ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
            console.log(`     Señal: ${cabinet.signal || 'N/A'}`);
            console.log(`     Modelo: ${cabinet.model || 'N/A'}`);
            console.log(`     Ubicación: ${cabinet.address || 'N/A'}`);
          });

          // 3. Verificar detalles del primer gabinete
          if (cabinets[0]) {
            console.log('\n🔍 Paso 3: Obteniendo detalles del primer gabinete...');
            const detailsResponse = await axios.post(
              `${WSCHARGE_API_URL}/equipment/detail`,
              {
                device_number: cabinets[0].device_number
              },
              {
                headers: {
                  'ocode': WSCHARGE_OCODE,
                  'token': token,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (detailsResponse.data.code === 200) {
              const details = detailsResponse.data.data;
              console.log('✅ Detalles obtenidos:');
              console.log(`   Gabinete: ${details.device_number}`);
              console.log(`   Estado: ${details.is_online === 1 ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
              console.log(`   Señal: ${details.signal}`);
              console.log(`   Slots: ${details.slot_count || 'N/A'}`);
              console.log(`   Baterías: ${details.battery_count || 'N/A'}`);
            }
          }
        }
      }
    }

    console.log('\n\n✅ Prueba completada exitosamente!');
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Si ves gabinetes arriba, copia el device_number');
    console.log('   2. Agrégalo en el admin panel: http://localhost:5173/cabinets');
    console.log('   3. O insértalo directamente en la base de datos usando Prisma Studio');

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.response) {
      console.error('Código de estado:', error.response.status);
      console.error('Respuesta:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 401) {
        console.log('\n💡 Solución:');
        console.log('   Las credenciales son incorrectas. Verifica:');
        console.log('   - WSCHARGE_OCODE: samuelcharge');
        console.log('   - WSCHARGE_USERNAME: admin');
        console.log('   - WSCHARGE_PASSWORD: 111111');
      }
    }
  }
}

// Ejecutar el test
testWsChargeConnection().catch(console.error);
