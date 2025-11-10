import { prisma } from '../src/lib/prisma';
import { wsChargeApiService } from '../src/services/wscharge-api.service';
import { CabinetStatus } from '@prisma/client';

/**
 * Script de diagnóstico para verificar por qué un gabinete no aparece como Online
 * Compara el estado en la base de datos local vs WsCharge API
 */

async function diagnoseCabinetStatus() {
  console.log('🔍 DIAGNÓSTICO DE ESTADO DE GABINETES\n');
  console.log('━'.repeat(80));

  try {
    // 1. Obtener gabinetes de la base de datos local
    console.log('\n📊 PASO 1: Verificando gabinetes en base de datos local...\n');
    const localCabinets = await prisma.cabinet.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    if (localCabinets.length === 0) {
      console.log('⚠️  No hay gabinetes registrados en la base de datos local.\n');
      console.log('💡 Solución: Registra un gabinete primero usando:');
      console.log('   pnpm run setup:cabinet\n');
      return;
    }

    console.log(`✅ Encontrados ${localCabinets.length} gabinete(s) en la base de datos local:\n`);
    localCabinets.forEach((cabinet) => {
      const statusIcon = cabinet.status === CabinetStatus.ONLINE ? '🟢' : '🔴';
      const lastPing = cabinet.lastPingAt
        ? `Último ping: ${cabinet.lastPingAt.toLocaleString()}`
        : 'Nunca ha enviado ping';
      console.log(`   ${statusIcon} ${cabinet.id} - ${cabinet.status}`);
      console.log(`      Nombre: ${cabinet.name || 'Sin nombre'}`);
      console.log(`      ${lastPing}`);
      console.log(`      Actualizado: ${cabinet.updatedAt.toLocaleString()}\n`);
    });

    // 2. Obtener gabinetes de WsCharge API
    console.log('━'.repeat(80));
    console.log('\n📡 PASO 2: Verificando gabinetes en WsCharge API...\n');

    try {
      await wsChargeApiService.ensureAuthenticated();
      const wsChargeResponse = await wsChargeApiService.getCabinetList({
        page: 1,
        limit: 100,
      });

      const wsChargeCabinets = wsChargeResponse.list || [];

      if (wsChargeCabinets.length === 0) {
        console.log('⚠️  No hay gabinetes registrados en WsCharge API.\n');
        console.log('💡 Solución: Registra el gabinete en WsCharge primero.\n');
      } else {
        console.log(`✅ Encontrados ${wsChargeCabinets.length} gabinete(s) en WsCharge:\n`);
        wsChargeCabinets.forEach((cabinet: any) => {
          const cabinetId = cabinet.cabinet_id || cabinet.device_number;
          const isOnline = cabinet.is_online === 1;
          const statusIcon = isOnline ? '🟢' : '🔴';
          const status = isOnline ? 'ONLINE' : 'OFFLINE';
          console.log(`   ${statusIcon} ${cabinetId} - ${status}`);
          console.log(`      Nombre: ${cabinet.name || 'Sin nombre'}`);
          if (cabinet.heart_time) {
            const heartTime = new Date(cabinet.heart_time * 1000);
            const minutesAgo = Math.floor((Date.now() - heartTime.getTime()) / 60000);
            const hoursAgo = Math.floor(minutesAgo / 60);
            const daysAgo = Math.floor(hoursAgo / 24);
            let timeAgo = '';
            if (daysAgo > 0) {
              timeAgo = `hace ${daysAgo} día(s)`;
            } else if (hoursAgo > 0) {
              timeAgo = `hace ${hoursAgo} hora(s)`;
            } else {
              timeAgo = `hace ${minutesAgo} minuto(s)`;
            }
            console.log(`      Último heartbeat: ${heartTime.toLocaleString()} (${timeAgo})`);
          } else {
            console.log(`      Último heartbeat: No disponible`);
          }
          if (cabinet.signal) {
            console.log(`      Señal: ${cabinet.signal}/31`);
          }
          console.log('');
        });
      }

      // 3. Comparar y detectar problemas
      console.log('━'.repeat(80));
      console.log('\n🔍 PASO 3: Análisis de sincronización...\n');

      const localCabinetIds = new Set(localCabinets.map((c) => c.id));
      const wsChargeCabinetIds = new Set(
        wsChargeCabinets.map((c: any) => c.cabinet_id || c.device_number)
      );

      // Gabinetes en local pero no en WsCharge
      const onlyInLocal = localCabinets.filter((c) => !wsChargeCabinetIds.has(c.id));
      if (onlyInLocal.length > 0) {
        console.log('⚠️  PROBLEMA DETECTADO: Gabinetes en BD local pero NO en WsCharge:\n');
        onlyInLocal.forEach((cabinet) => {
          console.log(`   ❌ ${cabinet.id} - ${cabinet.status}`);
          console.log(`      Este gabinete está registrado localmente pero no existe en WsCharge.`);
          console.log(`      No podrá aparecer como ONLINE hasta que se registre en WsCharge.\n`);
        });
      }

      // Gabinetes en WsCharge pero no en local
      const onlyInWsCharge = wsChargeCabinets.filter(
        (c: any) => !localCabinetIds.has(c.cabinet_id || c.device_number)
      );
      if (onlyInWsCharge.length > 0) {
        console.log('⚠️  PROBLEMA DETECTADO: Gabinetes en WsCharge pero NO en BD local:\n');
        onlyInWsCharge.forEach((cabinet: any) => {
          const cabinetId = cabinet.cabinet_id || cabinet.device_number;
          console.log(`   ❌ ${cabinetId}`);
          console.log(`      Este gabinete existe en WsCharge pero no está sincronizado localmente.`);
          console.log(`      El servicio de sincronización debería agregarlo automáticamente.\n`);
        });
      }

      // Gabinetes en ambos pero con estados diferentes
      const mismatchedStatus: Array<{
        id: string;
        localStatus: CabinetStatus;
        wsChargeStatus: string;
        isOnline: boolean;
      }> = [];

      localCabinets.forEach((localCabinet) => {
        const wsChargeCabinet = wsChargeCabinets.find(
          (c: any) => (c.cabinet_id || c.device_number) === localCabinet.id
        );

        if (wsChargeCabinet) {
          const isOnline = wsChargeCabinet.is_online === 1;
          const wsChargeStatus = isOnline ? CabinetStatus.ONLINE : CabinetStatus.OFFLINE;

          if (localCabinet.status !== wsChargeStatus) {
            mismatchedStatus.push({
              id: localCabinet.id,
              localStatus: localCabinet.status,
              wsChargeStatus,
              isOnline,
            });
          }
        }
      });

      if (mismatchedStatus.length > 0) {
        console.log('⚠️  PROBLEMA DETECTADO: Estados desincronizados:\n');
        mismatchedStatus.forEach(({ id, localStatus, wsChargeStatus, isOnline }) => {
          console.log(`   ❌ ${id}:`);
          console.log(`      BD Local: ${localStatus}`);
          console.log(`      WsCharge: ${wsChargeStatus} (is_online: ${isOnline ? 1 : 0})`);
          console.log(`      El estado no está sincronizado entre BD local y WsCharge.\n`);
        });
      }

      // 4. Resumen y soluciones
      console.log('━'.repeat(80));
      console.log('\n📋 RESUMEN Y SOLUCIONES:\n');

      if (onlyInLocal.length === 0 && onlyInWsCharge.length === 0 && mismatchedStatus.length === 0) {
        console.log('✅ No se detectaron problemas de sincronización.\n');

        // Verificar si hay gabinetes offline
        const offlineCabinets = localCabinets.filter((c) => c.status === CabinetStatus.OFFLINE);
        if (offlineCabinets.length > 0) {
          console.log('⚠️  Sin embargo, hay gabinetes marcados como OFFLINE:\n');
          offlineCabinets.forEach((cabinet) => {
            console.log(`   🔴 ${cabinet.id}`);
            const wsChargeCabinet = wsChargeCabinets.find(
              (c: any) => (c.cabinet_id || c.device_number) === cabinet.id
            );

            if (wsChargeCabinet) {
              const isOnline = wsChargeCabinet.is_online === 1;
              if (isOnline) {
                console.log(`      ⚠️  WsCharge dice que está ONLINE, pero la BD local dice OFFLINE.`);
                console.log(`      💡 Solución: Forzar sincronización manual:\n`);
                console.log(`         pnpm run sync:cabinets\n`);
              } else {
                console.log(`      ℹ️  El gabinete está realmente OFFLINE en WsCharge.`);
                console.log(`      💡 Para que aparezca ONLINE:`);
                console.log(`         1. Verifica que el gabinete físico esté encendido`);
                console.log(`         2. Verifica que tenga conexión a internet (WiFi/4G)`);
                console.log(`         3. Verifica que esté configurado para conectarse a WsCharge`);
                console.log(`         4. El gabinete debe enviar heartbeats cada ~45 segundos\n`);
              }
            }
          });
        } else {
          console.log('✅ Todos los gabinetes están ONLINE.\n');
        }
      } else {
        console.log('🔧 SOLUCIONES RECOMENDADAS:\n');

        if (onlyInLocal.length > 0) {
          console.log('1. Para gabinetes solo en BD local:');
          console.log('   - Registra estos gabinetes en WsCharge usando la API');
          console.log('   - O elimínalos de la BD local si no son válidos\n');
        }

        if (onlyInWsCharge.length > 0) {
          console.log('2. Para gabinetes solo en WsCharge:');
          console.log('   - El servicio de sincronización debería agregarlos automáticamente');
          console.log('   - Verifica que el servicio esté corriendo:');
          console.log('     * Revisa los logs del servidor');
          console.log('     * Verifica que WSCHARGE_SYNC_INTERVAL_SECONDS esté configurado');
          console.log('   - O fuerza una sincronización manual:\n');
          console.log('     pnpm run sync:cabinets\n');
        }

        if (mismatchedStatus.length > 0) {
          console.log('3. Para estados desincronizados:');
          console.log('   - Fuerza una sincronización manual:');
          console.log('     pnpm run sync:cabinets');
          console.log('   - O espera a que el servicio de sincronización automática los actualice\n');
        }
      }

      // 5. Verificar servicio de sincronización
      console.log('━'.repeat(80));
      console.log('\n⚙️  VERIFICACIÓN DEL SERVICIO DE SINCRONIZACIÓN:\n');
      const syncInterval = process.env.WSCHARGE_SYNC_INTERVAL_SECONDS || '30';
      console.log(`   Intervalo de sincronización: ${syncInterval} segundos`);
      console.log(`   El servicio debería sincronizar automáticamente cada ${syncInterval} segundos.`);
      console.log(`   Verifica que el servidor esté corriendo y revisa los logs.\n`);

      // 6. Comandos útiles
      console.log('━'.repeat(80));
      console.log('\n💡 COMANDOS ÚTILES:\n');
      console.log('   pnpm run check:cabinet        - Verificar estado de un gabinete específico');
      console.log('   pnpm run sync:cabinets        - Sincronizar gabinetes manualmente (si existe)');
      console.log('   pnpm run setup:cabinet        - Configurar un nuevo gabinete');
      console.log('   pnpm run dev                  - Iniciar servidor en modo desarrollo\n');
    } catch (error: any) {
      console.error('❌ Error al conectar con WsCharge API:', error.message);
      if (error.response?.data) {
        console.error('   Detalles:', JSON.stringify(error.response.data, null, 2));
      }
      console.log('\n💡 Verifica:');
      console.log('   1. Que las credenciales de WsCharge estén configuradas (.env)');
      console.log('   2. Que tengas conexión a internet');
      console.log('   3. Que la URL de WsCharge sea correcta\n');
    }
  } catch (error: any) {
    console.error('❌ Error fatal:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar diagnóstico
diagnoseCabinetStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });

