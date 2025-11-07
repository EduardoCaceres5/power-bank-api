import { io, Socket } from 'socket.io-client';
import { logger } from '../src/lib/logger';
import {
  WsChargeFunctionCode,
  WsChargeLoginMessage,
  WsChargeQueryInventoryResponse,
} from '../src/types/wscharge.types';

/**
 * Emulador de Gabinete PM8
 * Simula un gabinete físico conectándose a tu servidor LOCAL vía WebSocket
 *
 * NOTA: Este emulador se conecta a TU servidor (localhost:3000)
 * NO se conecta al servidor real de WsCharge
 */

const CABINET_ID = 'GT042250704279';
const SERVER_URL = 'http://localhost:3000';
const WEBSOCKET_PATH = '/wscharge';

class CabinetEmulator {
  private socket: Socket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    console.log(`🔌 Conectando al servidor: ${SERVER_URL}${WEBSOCKET_PATH}...\n`);

    this.socket = io(SERVER_URL, {
      path: WEBSOCKET_PATH,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Conectado al servidor!');
      console.log(`📡 Socket ID: ${this.socket?.id}\n`);
      this.sendLogin();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`❌ Desconectado: ${reason}\n`);
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error(`❌ Error de conexión: ${error.message}`);
      console.log('\n💡 Asegúrate de que el servidor esté corriendo:');
      console.log('   npm run dev\n');
    });

    this.socket.on('message', (data: any) => {
      this.handleMessage(data);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Error:', error);
    });
  }

  private sendLogin() {
    const loginMessage: WsChargeLoginMessage = {
      I: WsChargeFunctionCode.LOGIN,
      E: CABINET_ID,
    };

    console.log('📤 Enviando LOGIN...');
    this.socket?.emit('message', loginMessage);
    console.log(`   Cabinet ID: ${CABINET_ID}\n`);

    // Iniciar heartbeat cada 45 segundos
    this.startHeartbeat();
  }

  private startHeartbeat() {
    console.log('💓 Iniciando heartbeat (cada 45 segundos)...\n');

    this.heartbeatInterval = setInterval(() => {
      console.log(`💓 Heartbeat: ${new Date().toLocaleTimeString()}`);
      // El login también sirve como heartbeat
      this.sendLogin();
    }, 45000); // 45 segundos
  }

  private handleMessage(message: any) {
    console.log('📥 Mensaje recibido del servidor:');

    const functionCode = message.I;

    switch (functionCode) {
      case WsChargeFunctionCode.QUERY_INVENTORY:
        console.log('   Tipo: QUERY_INVENTORY (solicitud de inventario)');
        this.sendInventoryResponse();
        break;

      case WsChargeFunctionCode.RENT_POWER_BANK:
        console.log('   Tipo: RENT_POWER_BANK (solicitud de renta)');
        console.log(`   Slot solicitado: ${message.L}`);
        this.sendRentResponse(message);
        break;

      case WsChargeFunctionCode.FORCE_EJECT:
        console.log('   Tipo: FORCE_EJECT (expulsión forzada)');
        console.log(`   Slot: ${message.L}`);
        break;

      default:
        console.log(`   Tipo desconocido: ${functionCode}`);
        console.log('   Data:', JSON.stringify(message, null, 2));
    }

    console.log('');
  }

  private sendInventoryResponse() {
    // Simulamos 8 slots del PM8
    const inventoryResponse: WsChargeQueryInventoryResponse = {
      I: WsChargeFunctionCode.QUERY_INVENTORY,
      E: CABINET_ID,
      K: '86138000000000000001', // SIM card ficticia
      X: '07', // Señal 7/10 en hex
      terminalArr: [
        { B: 'PB2405010001', E: '01', D: 95 },  // Slot 1: 95% batería
        { B: 'PB2405010002', E: '02', D: 88 },  // Slot 2: 88% batería
        { B: 'PB2405010003', E: '03', D: 100 }, // Slot 3: 100% batería
        { B: 'PB2405010004', E: '04', D: 72 },  // Slot 4: 72% batería
        { B: 'PB2405010005', E: '05', D: 65 },  // Slot 5: 65% batería
        // Slot 6, 7, 8 vacíos
      ],
    };

    console.log('📤 Enviando inventario...');
    console.log(`   Total power banks: ${inventoryResponse.terminalArr.length}`);
    this.socket?.emit('message', inventoryResponse);
  }

  private sendRentResponse(request: any) {
    const slotNumber = request.L;
    const powerBankId = `PB240501000${slotNumber}`;

    const rentResponse = {
      I: WsChargeFunctionCode.RENT_POWER_BANK,
      E: CABINET_ID,
      L: slotNumber,
      B: powerBankId,
      S: '200', // Success
    };

    console.log('📤 Enviando respuesta de renta...');
    console.log(`   Power Bank: ${powerBankId}`);
    console.log(`   Status: 200 (Success)`);
    this.socket?.emit('message', rentResponse);
  }

  public disconnect() {
    console.log('\n🔌 Desconectando del servidor...');
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.socket?.disconnect();
    console.log('✅ Desconectado\n');
  }
}

// Ejecutar emulador
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║         EMULADOR DE GABINETE PM8 - GT042250704279         ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const emulator = new CabinetEmulator();

// Manejar Ctrl+C
process.on('SIGINT', () => {
  emulator.disconnect();
  process.exit(0);
});

console.log('💡 Presiona Ctrl+C para detener el emulador\n');
