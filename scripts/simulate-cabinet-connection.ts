import axios from 'axios';
import { logger } from '../src/lib/logger';

/**
 * Simulador de conexión del gabinete a WsCharge
 *
 * NOTA: Este script NO se conecta vía WebSocket real.
 * Solo simula el heartbeat usando la API HTTP de WsCharge.
 *
 * Para que is_online sea 1, el gabinete físico debe:
 * 1. Conectarse a internet (WiFi/4G)
 * 2. Establecer WebSocket con api.w-dian.cn
 * 3. Enviar heartbeats cada 45 segundos
 */

const CABINET_ID = 'GT042250704279';
const WSCHARGE_API_URL = 'https://api.w-dian.cn/operate';

async function checkCabinetStatus() {
  try {
    console.log('🔍 Verificando estado del gabinete...\n');

    // Login
    const loginResponse = await axios.post(
      `${WSCHARGE_API_URL}/auth/login`,
      new URLSearchParams({
        name: process.env.WSCHARGE_USERNAME || 'admin',
        password: process.env.WSCHARGE_PASSWORD || '111111'
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'ocode': process.env.WSCHARGE_OCODE || 'samuelcharge'
        }
      }
    );

    const token = loginResponse.data.data.token;

    // Obtener info del gabinete
    const infoResponse = await axios.post(
      `${WSCHARGE_API_URL}/equipment/info`,
      new URLSearchParams({
        cabinet_id: CABINET_ID
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'ocode': process.env.WSCHARGE_OCODE || 'samuelcharge',
          'token': token
        }
      }
    );

    const cabinetInfo = infoResponse.data.data;

    console.log('📊 Estado del gabinete:');
    console.log('━'.repeat(60));
    console.log(`Cabinet ID: ${cabinetInfo.cabinet_id}`);
    console.log(`Modelo: ${cabinetInfo.model}`);
    console.log(`Estado: ${cabinetInfo.is_online === 1 ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
    console.log(`Último heartbeat: ${new Date(cabinetInfo.heart_time * 1000).toLocaleString()}`);
    console.log(`IoT Card: ${cabinetInfo.network_card || 'No configurada'}`);
    console.log(`Volumen: ${cabinetInfo.volume}%`);
    console.log('━'.repeat(60));

    // Calcular tiempo desde último heartbeat
    const now = Math.floor(Date.now() / 1000);
    const timeSinceHeartbeat = now - cabinetInfo.heart_time;
    const minutesSinceHeartbeat = Math.floor(timeSinceHeartbeat / 60);

    console.log(`\n⏱️  Último heartbeat fue hace: ${minutesSinceHeartbeat} minutos`);

    if (cabinetInfo.is_online === 0) {
      console.log(`
⚠️  EL GABINETE ESTÁ OFFLINE

Posibles causas:
1. ❌ El gabinete no está conectado a internet
2. ❌ El gabinete no está configurado con el servidor correcto
3. ❌ El gabinete está apagado o sin energía
4. ❌ Problema de conectividad (WiFi/4G débil)

Para que is_online sea 1:
✅ El gabinete físico PM8 debe establecer conexión WebSocket con WsCharge
✅ El heartbeat debe ser reciente (< 2 minutos)
✅ El gabinete debe estar encendido y con internet

Próximos pasos:
1. Verifica que el gabinete esté encendido
2. Asegúrate de que esté conectado a WiFi
3. Contacta al proveedor para configurar la conexión al servidor
      `);
    } else {
      console.log(`
✅ EL GABINETE ESTÁ ONLINE

El gabinete está conectado y enviando heartbeats.
      `);

      // Intentar obtener detalles
      try {
        const detailsResponse = await axios.post(
          `${WSCHARGE_API_URL}/equipment/detail`,
          new URLSearchParams({
            cabinet_id: CABINET_ID
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'ocode': process.env.WSCHARGE_OCODE || 'samuelcharge',
              'token': token
            }
          }
        );

        const details = detailsResponse.data.data;
        console.log('\n🔋 Power Banks en el gabinete:');
        console.log('━'.repeat(60));

        details.device.forEach((slot: any) => {
          if (slot.bid) {
            console.log(`Slot ${slot.lock}: ${slot.bid} - ${slot.power}% batería ${slot.quick_charge === 1 ? '⚡' : ''}`);
          } else {
            console.log(`Slot ${slot.lock}: Vacío`);
          }
        });
        console.log('━'.repeat(60));
      } catch (error) {
        console.log('\n⚠️  No se pudieron obtener los detalles del gabinete');
      }
    }

    console.log(`\n💡 Tip: El gabinete envía heartbeat cada ~45 segundos.
Si quieres ver el cambio de estado, ejecuta este script varias veces.
    `);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Detalles:', error.response.data);
    }
    process.exit(1);
  }
}

// Ejecutar
checkCabinetStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
