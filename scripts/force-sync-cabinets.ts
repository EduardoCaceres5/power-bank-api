import { wsChargeSyncService } from '../src/services/wschargeSyncService';
import { logger } from '../src/lib/logger';

/**
 * Script para forzar una sincronización inmediata de gabinetes desde WsCharge
 */

async function forceSync() {
  console.log('🔄 Forzando sincronización de gabinetes desde WsCharge...\n');

  try {
    await wsChargeSyncService.forceSyncNow();
    console.log('✅ Sincronización completada exitosamente.\n');
    console.log('💡 Ejecuta "pnpm run diagnose:cabinet" para ver el estado actualizado.\n');
  } catch (error: any) {
    console.error('❌ Error al sincronizar:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

forceSync()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });

