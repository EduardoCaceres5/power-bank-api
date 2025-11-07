import { wsChargeApiService } from '../src/services/wscharge-api.service';
import { logger } from '../src/lib/logger';

/**
 * Script para configurar el gabinete GT042250704279
 * Modelo: PM8 (Desktop 8-slots Cabinet with screen)
 */
async function setupCabinet() {
  const CABINET_ID = 'GT042250704279';
  const MODEL = 'pm8';

  try {
    console.log('🚀 Iniciando configuración del gabinete...\n');

    // Paso 1: Verificar autenticación
    console.log('1️⃣  Verificando autenticación...');
    await wsChargeApiService.initialize();

    if (!wsChargeApiService.isAuthenticated()) {
      throw new Error('No se pudo autenticar. Verifica las credenciales en .env');
    }
    console.log('✅ Autenticado correctamente\n');

    // Paso 2: Verificar si el gabinete ya existe
    console.log('2️⃣  Verificando si el gabinete ya está registrado...');
    try {
      const existingInfo = await wsChargeApiService.getCabinetInfo({
        cabinet_id: CABINET_ID
      });

      console.log('⚠️  El gabinete ya está registrado:');
      console.log(JSON.stringify(existingInfo, null, 2));
      console.log('\n¿Deseas continuar de todos modos? (Ctrl+C para cancelar)\n');

      // Esperar 3 segundos antes de continuar
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error: any) {
      if (error.response?.data?.code === 0) {
        console.log('✅ El gabinete no existe, procediendo con el registro...\n');
      } else {
        throw error;
      }
    }

    // Paso 3: Registrar el gabinete
    console.log('3️⃣  Registrando gabinete en el sistema WsCharge...');
    const registerResult = await wsChargeApiService.addCabinet({
      cabinet_id: CABINET_ID,
      qrcode: CABINET_ID, // Usando el mismo ID como QR code
      model: MODEL,
      // sim: '' // Opcional: agregar si tiene tarjeta SIM
    });

    console.log('✅ Gabinete registrado exitosamente:');
    console.log(JSON.stringify(registerResult, null, 2));
    console.log('');

    // Paso 4: Obtener información del gabinete
    console.log('4️⃣  Obteniendo información del gabinete...');
    const cabinetInfo = await wsChargeApiService.getCabinetInfo({
      cabinet_id: CABINET_ID
    });

    console.log('📋 Información del gabinete:');
    console.log(JSON.stringify(cabinetInfo, null, 2));
    console.log('');

    // Paso 5: Obtener detalles (slots y power banks)
    console.log('5️⃣  Obteniendo detalles de slots y power banks...');
    try {
      const cabinetDetails = await wsChargeApiService.getCabinetDetails({
        cabinet_id: CABINET_ID
      });

      console.log('🔋 Detalles del gabinete:');
      console.log(`   Online: ${cabinetDetails.is_online === 1 ? 'Sí ✅' : 'No ❌'}`);
      console.log(`   Señal: ${cabinetDetails.signal}/10`);
      console.log(`   Slots totales: ${cabinetDetails.device?.length || 0}`);

      if (cabinetDetails.device && cabinetDetails.device.length > 0) {
        console.log('\n   Power Banks disponibles:');
        cabinetDetails.device.forEach((slot, index) => {
          if (slot.bid) {
            console.log(`   - Slot ${slot.lock}: ${slot.bid} (${slot.power}% batería)${slot.quick_charge === 1 ? ' ⚡ Carga rápida' : ''}`);
          } else {
            console.log(`   - Slot ${slot.lock}: Vacío`);
          }
        });
      }
      console.log('');
    } catch (error: any) {
      console.log('⚠️  No se pudieron obtener detalles (el gabinete podría estar offline)');
      console.log('');
    }

    // Paso 6: Listar todos los gabinetes
    console.log('6️⃣  Listando todos los gabinetes registrados...');
    const cabinetList = await wsChargeApiService.getCabinetList({
      page: 1,
      page_size: 10
    });

    console.log(`📊 Total de gabinetes: ${cabinetList.total}`);
    console.log(`   Online: ${cabinetList.online_num}`);
    console.log(`   Offline: ${cabinetList.offline_num}`);

    if (cabinetList.list && cabinetList.list.length > 0) {
      console.log('\n   Lista de gabinetes:');
      cabinetList.list.forEach(cabinet => {
        console.log(`   - ${cabinet.cabinet_id} (${cabinet.model}): ${cabinet.is_online === 1 ? '🟢 Online' : '🔴 Offline'}`);
        console.log(`     Power banks disponibles: ${cabinet.return_num}, Prestados: ${cabinet.borrow_num}`);
      });
    }

    console.log('\n');
    console.log('=' .repeat(60));
    console.log('🎉 ¡Configuración completada exitosamente!');
    console.log('=' .repeat(60));
    console.log(`
Próximos pasos:

1. Asegúrate de que el gabinete físico GT042250704279 esté:
   - Conectado a internet
   - Encendido
   - Configurado para conectarse a tu servidor

2. El gabinete se conectará vía WebSocket a:
   ws://tu-servidor:3000/wscharge

3. Puedes monitorear la conexión en los logs del servidor

4. Una vez conectado, podrás:
   - Ver el inventario en tiempo real
   - Rentar power banks
   - Recibir notificaciones de devoluciones
    `);

  } catch (error: any) {
    console.error('\n❌ Error durante la configuración:');
    console.error(error.message || error);

    if (error.response?.data) {
      console.error('\nDetalles del error:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }

    process.exit(1);
  }
}

// Ejecutar el script
setupCabinet()
  .then(() => {
    console.log('\n✅ Script finalizado correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
