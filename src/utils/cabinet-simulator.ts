/**
 * WsCharge Cabinet Simulator
 * Útil para testing sin hardware físico
 *
 * Uso:
 * ts-node src/utils/cabinet-simulator.ts
 */

import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const CABINET_ID = process.env.CABINET_ID || 'WSTD088888888888';

class CabinetSimulator {
  private socket: Socket;
  private cabinetId: string;
  private slots: Map<number, { powerBankId: string; batteryLevel: number }>;

  constructor(cabinetId: string) {
    this.cabinetId = cabinetId;
    this.slots = new Map();

    // Inicializar 8 slots con power banks
    for (let i = 1; i <= 8; i++) {
      this.slots.set(i, {
        powerBankId: `WSBA${String(i).padStart(8, '0')}`,
        batteryLevel: 80 + Math.floor(Math.random() * 20), // 80-100%
      });
    }

    this.socket = io(BACKEND_URL, {
      path: '/wscharge',
      transports: ['websocket'],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
      this.sendLogin();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    this.socket.on('message', (data: any) => {
      console.log('📨 Received message:', data);
      this.handleMessage(data);
    });

    this.socket.on('error', (error: any) => {
      console.error('❌ Socket error:', error);
    });
  }

  private sendLogin() {
    const loginMessage = {
      I: 60,
      E: this.cabinetId,
    };

    console.log('📤 Sending login:', loginMessage);
    this.socket.emit('message', loginMessage);
  }

  private handleMessage(data: any) {
    const functionCode = data.I;

    switch (functionCode) {
      case 64: // Query Inventory
        this.handleQueryInventory();
        break;

      case 65: // Rent Power Bank
        this.handleRent(data);
        break;

      case 80: // Force Eject
        this.handleForceEject(data);
        break;

      case 81: // Full Eject
        this.handleFullEject();
        break;

      case 67: // Restart
        this.handleRestart();
        break;

      default:
        console.warn('⚠️ Unknown function code:', functionCode);
    }
  }

  private handleQueryInventory() {
    const terminalArr = Array.from(this.slots.entries()).map(
      ([slotNumber, { powerBankId, batteryLevel }]) => ({
        B: powerBankId,
        E: String(slotNumber).padStart(2, '0'),
        D: batteryLevel,
      })
    );

    const response = {
      I: 64,
      E: this.cabinetId,
      K: '898604A3192270008460', // Fake IoT card number
      X: '1F', // Signal strength in hex
      terminalArr,
    };

    console.log('📤 Sending inventory:', response);
    this.socket.emit('message', response);
  }

  private handleRent(data: any) {
    const slotNumber = parseInt(data.L, 10);
    const slot = this.slots.get(slotNumber);

    let status = '200'; // Success
    let powerBankId = '';

    if (!slot) {
      status = '201'; // Invalid slot
    } else {
      powerBankId = slot.powerBankId;
      // Remover power bank del slot
      this.slots.delete(slotNumber);
      console.log(`🔋 Power bank ${powerBankId} ejected from slot ${slotNumber}`);
    }

    const response = {
      I: 65,
      E: this.cabinetId,
      L: data.L,
      B: powerBankId,
      S: status,
    };

    console.log('📤 Sending rent response:', response);
    this.socket.emit('message', response);
  }

  private handleForceEject(data: any) {
    const slotNumber = parseInt(data.L, 10);
    const slot = this.slots.get(slotNumber);

    let status = '200';
    if (!slot) {
      status = '202'; // Slot empty
    } else {
      this.slots.delete(slotNumber);
      console.log(`🔋 Force ejected slot ${slotNumber}`);
    }

    const response = {
      I: 80,
      E: this.cabinetId,
      L: data.L,
      S: status,
    };

    console.log('📤 Sending force eject response:', response);
    this.socket.emit('message', response);
  }

  private handleFullEject() {
    this.slots.clear();
    console.log('🔋 All power banks ejected');

    const response = {
      I: 81,
      E: this.cabinetId,
      S: '200',
    };

    console.log('📤 Sending full eject response:', response);
    this.socket.emit('message', response);
  }

  private handleRestart() {
    console.log('🔄 Restarting cabinet...');

    const response = {
      I: 67,
      E: this.cabinetId,
      S: '200',
    };

    this.socket.emit('message', response);

    // Simular restart
    setTimeout(() => {
      console.log('✅ Cabinet restarted');
      this.sendLogin();
    }, 2000);
  }

  /**
   * Simular retorno de power bank
   */
  public simulateReturn(slotNumber: number) {
    const powerBankId = `WSBA${String(slotNumber).padStart(8, '0')}`;

    this.slots.set(slotNumber, {
      powerBankId,
      batteryLevel: 30 + Math.floor(Math.random() * 20), // 30-50% al regresar
    });

    const message = {
      I: 66,
      E: this.cabinetId,
      L: String(slotNumber).padStart(2, '0'),
      B: powerBankId,
    };

    console.log('📤 Sending return message:', message);
    this.socket.emit('message', message);
  }

  public disconnect() {
    const offlineMessage = {
      I: 90,
      E: this.cabinetId,
    };

    this.socket.emit('message', offlineMessage);
    this.socket.disconnect();
  }
}

// ==================== MAIN ====================

if (require.main === module) {
  console.log('🎮 WsCharge Cabinet Simulator');
  console.log(`📍 Connecting to: ${BACKEND_URL}`);
  console.log(`🆔 Cabinet ID: ${CABINET_ID}`);
  console.log('');

  const simulator = new CabinetSimulator(CABINET_ID);

  // Simular retorno de power bank cada 30 segundos
  setInterval(() => {
    const randomSlot = Math.floor(Math.random() * 8) + 1;
    console.log(`\n🔄 Simulating return to slot ${randomSlot}...`);
    simulator.simulateReturn(randomSlot);
  }, 30000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down simulator...');
    simulator.disconnect();
    process.exit(0);
  });
}

export default CabinetSimulator;
