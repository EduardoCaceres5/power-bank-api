/**
 * Script de prueba para simular un dispositivo enviando heartbeats
 *
 * Este script:
 * 1. Se autentica como un dispositivo
 * 2. Envía heartbeats periódicos al servidor
 * 3. Simula cambios en el estado de los slots
 *
 * Uso:
 *   pnpm tsx scripts/test-device-heartbeat.ts
 */

import axios from 'axios';
import 'dotenv/config';

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const DEVICE_ID = process.env.TEST_DEVICE_ID || 'test-device-001';
const DEVICE_SECRET = process.env.TEST_DEVICE_SECRET || 'test-secret-key-123456789';
const HEARTBEAT_INTERVAL_SECONDS = 30; // Intervalo entre heartbeats

interface DeviceToken {
  token: string;
  cabinetId: string;
  expiresIn: number;
}

interface SlotState {
  slotNumber: number;
  isOccupied: boolean;
  powerBankId?: string;
  batteryLevel?: number;
}

class DeviceSimulator {
  private token: string | null = null;
  private cabinetId: string | null = null;
  private isRunning: boolean = false;
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private slots: SlotState[] = [];

  constructor() {
    // Inicializar slots (8 slots por defecto)
    for (let i = 1; i <= 8; i++) {
      this.slots.push({
        slotNumber: i,
        isOccupied: false,
      });
    }

    // Simular algunos power banks en los primeros 3 slots
    this.slots[0] = {
      slotNumber: 1,
      isOccupied: true,
      powerBankId: 'WSBA00000001',
      batteryLevel: 45,
    };

    this.slots[1] = {
      slotNumber: 2,
      isOccupied: true,
      powerBankId: 'WSBA00000002',
      batteryLevel: 78,
    };

    this.slots[2] = {
      slotNumber: 3,
      isOccupied: true,
      powerBankId: 'WSBA00000003',
      batteryLevel: 100,
    };
  }

  /**
   * Autentica el dispositivo y obtiene token
   */
  async authenticate(): Promise<void> {
    try {
      console.log('\n🔐 Authenticating device...');
      console.log(`Device ID: ${DEVICE_ID}`);

      const response = await axios.post(`${API_BASE_URL}/device/auth/login`, {
        deviceId: DEVICE_ID,
        deviceSecret: DEVICE_SECRET,
      });

      const data: DeviceToken = response.data.data;
      this.token = data.token;
      this.cabinetId = data.cabinetId;

      console.log('✅ Authentication successful!');
      console.log(`Cabinet ID: ${this.cabinetId}`);
      console.log(`Token expires in: ${data.expiresIn} seconds`);
    } catch (error: any) {
      console.error('❌ Authentication failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Envía un heartbeat al servidor
   */
  async sendHeartbeat(): Promise<void> {
    if (!this.token) {
      console.error('❌ No token available. Please authenticate first.');
      return;
    }

    try {
      // Simular cambios en los niveles de batería
      this.simulateBatteryChanges();

      const heartbeatData = {
        status: 'ONLINE',
        signalStrength: Math.floor(Math.random() * 10) + 20, // 20-30
        ipAddress: '192.168.1.100',
        connectionType: 'wifi',
        slots: this.slots,
      };

      const response = await axios.post(
        `${API_BASE_URL}/device/heartbeat`,
        heartbeatData,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      const timestamp = new Date().toLocaleTimeString();
      console.log(`\n💓 [${timestamp}] Heartbeat sent successfully`);
      console.log(`   Status: ${response.data.data.status}`);
      console.log(`   Slots updated: ${response.data.data.slotsUpdated}`);

      // Mostrar estado de slots
      this.displaySlotStatus();
    } catch (error: any) {
      console.error('❌ Heartbeat failed:', error.response?.data || error.message);

      // Si el token expiró, intentar re-autenticar
      if (error.response?.status === 401) {
        console.log('🔄 Token expired, re-authenticating...');
        await this.authenticate();
      }
    }
  }

  /**
   * Simula cambios en los niveles de batería
   */
  private simulateBatteryChanges(): void {
    this.slots.forEach(slot => {
      if (slot.isOccupied && slot.batteryLevel !== undefined) {
        // Incrementar batería entre 1-5% (simulando carga)
        slot.batteryLevel = Math.min(100, slot.batteryLevel + Math.floor(Math.random() * 5) + 1);
      }
    });
  }

  /**
   * Muestra el estado actual de los slots
   */
  private displaySlotStatus(): void {
    console.log('   Slots:');
    this.slots.forEach(slot => {
      if (slot.isOccupied) {
        console.log(
          `      [${slot.slotNumber}] 🔋 ${slot.powerBankId} (${slot.batteryLevel}%)`
        );
      } else {
        console.log(`      [${slot.slotNumber}] ⚪ Empty`);
      }
    });
  }

  /**
   * Obtiene el estado actual del gabinete desde el servidor
   */
  async getStatus(): Promise<void> {
    if (!this.token) {
      console.error('❌ No token available. Please authenticate first.');
      return;
    }

    try {
      console.log('\n📊 Fetching cabinet status from server...');

      const response = await axios.get(`${API_BASE_URL}/device/status`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      const data = response.data.data;
      console.log('✅ Status retrieved successfully');
      console.log(`   Cabinet ID: ${data.cabinetId}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Last Ping: ${new Date(data.lastPingAt).toLocaleString()}`);
      console.log(`   Signal Strength: ${data.signalStrength}`);
      console.log(`   Slots: ${data.slots.length}`);
    } catch (error: any) {
      console.error('❌ Failed to get status:', error.response?.data || error.message);
    }
  }

  /**
   * Inicia el envío periódico de heartbeats
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  Device simulator is already running');
      return;
    }

    console.log(`\n🚀 Starting device simulator...`);
    console.log(`📡 Sending heartbeat every ${HEARTBEAT_INTERVAL_SECONDS} seconds`);
    console.log('Press Ctrl+C to stop\n');

    this.isRunning = true;

    // Enviar primer heartbeat inmediatamente
    this.sendHeartbeat();

    // Configurar intervalo para heartbeats periódicos
    this.heartbeatIntervalId = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_SECONDS * 1000);
  }

  /**
   * Detiene el envío de heartbeats
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('\n\n🛑 Stopping device simulator...');

    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    this.isRunning = false;
    console.log('✅ Device simulator stopped');
  }
}

// Función principal
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('           Device Heartbeat Simulator');
  console.log('═══════════════════════════════════════════════════════');

  const simulator = new DeviceSimulator();

  // Manejar Ctrl+C para detener gracefully
  process.on('SIGINT', () => {
    simulator.stop();
    process.exit(0);
  });

  try {
    // Autenticar
    await simulator.authenticate();

    // Obtener estado inicial
    await simulator.getStatus();

    // Esperar 2 segundos antes de comenzar
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Iniciar simulador
    simulator.start();
  } catch (error) {
    console.error('\n❌ Failed to start simulator:', error);
    process.exit(1);
  }
}

// Ejecutar
main();
