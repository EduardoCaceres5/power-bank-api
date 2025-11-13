import axios, { AxiosInstance } from 'axios';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/error.middleware';

interface PagoparConfig {
  publicKey: string;
  privateKey: string;
  merchantToken: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
}

interface CreateTransactionParams {
  amount: number;
  currency?: string;
  description: string;
  additionalData?: string;
}

interface CreatePreAuthParams {
  amount: number;
  currency?: string;
  description: string;
  cardToken?: string;
}

interface CapturePreAuthParams {
  preAuthId: string;
  amount?: number; // Si no se especifica, captura el monto completo
}

interface RegisterCardParams {
  holderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  customerEmail: string;
  customerName: string;
}

interface PagoparTransactionResponse {
  status: string;
  data: {
    transaction_id: string;
    process_id: string;
    checkout_url?: string;
    amount: number;
    currency: string;
  };
}

interface PagoparPreAuthResponse {
  status: string;
  data: {
    preauth_id: string;
    amount: number;
    status: 'approved' | 'rejected' | 'pending';
    expires_at: string;
  };
}

interface PagoparCardResponse {
  status: string;
  data: {
    card_token: string;
    last_four: string;
    brand: string;
    expiry: string;
  };
}

export class PagoparService {
  private client: AxiosInstance;
  private config: PagoparConfig;

  constructor() {
    this.config = {
      publicKey: process.env.PAGOPAR_PUBLIC_KEY || 'pk_test_placeholder',
      privateKey: process.env.PAGOPAR_PRIVATE_KEY || 'sk_test_placeholder',
      merchantToken: process.env.PAGOPAR_MERCHANT_TOKEN || 'token_placeholder',
      environment: (process.env.PAGOPAR_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      webhookSecret: process.env.PAGOPAR_WEBHOOK_SECRET,
    };

    const baseURL =
      this.config.environment === 'production'
        ? process.env.PAGOPAR_API_URL || 'https://api.pagopar.com/v1'
        : process.env.PAGOPAR_SANDBOX_URL || 'https://api.pagopar.com/sandbox';

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.privateKey}`,
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Pagopar API Error', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Crear una transacción simple
   */
  async createTransaction(params: CreateTransactionParams): Promise<PagoparTransactionResponse> {
    try {
      const response = await this.client.post('/transactions', {
        public_key: this.config.publicKey,
        operation: {
          token: this.config.merchantToken,
          amount: params.amount.toString(),
          currency: params.currency || 'PYG',
          description: params.description,
          additional_data: params.additionalData,
        },
      });

      logger.info('Pagopar transaction created', {
        transactionId: response.data.data.transaction_id,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Error creating Pagopar transaction', { error });
      throw new AppError(
        error.response?.status || 500,
        error.response?.data?.message || 'Failed to create transaction'
      );
    }
  }

  /**
   * Crear preautorización (reserva de fondos)
   * Ideal para alquiler de power banks
   */
  async createPreAuthorization(
    params: CreatePreAuthParams
  ): Promise<PagoparPreAuthResponse> {
    try {
      const response = await this.client.post('/preauth', {
        public_key: this.config.publicKey,
        token: this.config.merchantToken,
        amount: params.amount.toString(),
        currency: params.currency || 'PYG',
        description: params.description,
        ...(params.cardToken && { card_token: params.cardToken }),
      });

      logger.info('Pagopar preauthorization created', {
        preAuthId: response.data.data.preauth_id,
        amount: params.amount,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Error creating Pagopar preauthorization', { error });
      throw new AppError(
        error.response?.status || 500,
        error.response?.data?.message || 'Failed to create preauthorization'
      );
    }
  }

  /**
   * Capturar preautorización (cobrar el monto reservado)
   */
  async capturePreAuthorization(params: CapturePreAuthParams): Promise<any> {
    try {
      const response = await this.client.post(`/preauth/${params.preAuthId}/capture`, {
        ...(params.amount && { amount: params.amount.toString() }),
      });

      logger.info('Pagopar preauthorization captured', {
        preAuthId: params.preAuthId,
        amount: params.amount,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Error capturing Pagopar preauthorization', { error });
      throw new AppError(
        error.response?.status || 500,
        error.response?.data?.message || 'Failed to capture preauthorization'
      );
    }
  }

  /**
   * Cancelar preautorización (liberar fondos)
   */
  async voidPreAuthorization(preAuthId: string): Promise<any> {
    try {
      const response = await this.client.post(`/preauth/${preAuthId}/void`);

      logger.info('Pagopar preauthorization voided', { preAuthId });

      return response.data;
    } catch (error: any) {
      logger.error('Error voiding Pagopar preauthorization', { error });
      throw new AppError(
        error.response?.status || 500,
        error.response?.data?.message || 'Failed to void preauthorization'
      );
    }
  }

  /**
   * Registrar tarjeta (catastro) para pagos futuros
   */
  async registerCard(params: RegisterCardParams): Promise<PagoparCardResponse> {
    try {
      const response = await this.client.post('/cards/register', {
        public_key: this.config.publicKey,
        token: this.config.merchantToken,
        card: {
          holder_name: params.holderName,
          number: params.cardNumber,
          expiry_month: params.expiryMonth,
          expiry_year: params.expiryYear,
          cvv: params.cvv,
        },
        customer: {
          email: params.customerEmail,
          name: params.customerName,
        },
      });

      logger.info('Card registered in Pagopar', {
        lastFour: response.data.data.last_four,
        email: params.customerEmail,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Error registering card in Pagopar', { error });
      throw new AppError(
        error.response?.status || 500,
        error.response?.data?.message || 'Failed to register card'
      );
    }
  }

  /**
   * Obtener estado de transacción
   */
  async getTransactionStatus(transactionId: string): Promise<any> {
    try {
      const response = await this.client.get(`/transactions/${transactionId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Error getting transaction status', { error });
      throw new AppError(
        error.response?.status || 500,
        error.response?.data?.message || 'Failed to get transaction status'
      );
    }
  }

  /**
   * Validar firma de webhook
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      logger.warn('Webhook secret not configured, skipping validation');
      return true; // En desarrollo, permitir sin validación
    }

    // TODO: Implementar validación de firma según documentación de Pagopar
    // Generalmente es un HMAC SHA256 del payload con el secret
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Crear pago para alquiler (usando preautorización)
   * Este es el método principal para el sistema de power banks
   */
  async createRentalPreAuth(
    amount: number,
    description: string,
    cardToken?: string
  ): Promise<PagoparPreAuthResponse> {
    return this.createPreAuthorization({
      amount,
      currency: 'PYG',
      description,
      cardToken,
    });
  }

  /**
   * Completar pago de alquiler (capturar preautorización)
   */
  async completeRentalPayment(preAuthId: string, finalAmount?: number): Promise<any> {
    return this.capturePreAuthorization({
      preAuthId,
      amount: finalAmount,
    });
  }

  /**
   * Cancelar pago de alquiler (void preautorización)
   */
  async cancelRentalPayment(preAuthId: string): Promise<any> {
    return this.voidPreAuthorization(preAuthId);
  }

  /**
   * Verificar si el servicio está configurado correctamente
   */
  isConfigured(): boolean {
    return (
      this.config.publicKey !== 'pk_test_placeholder' &&
      this.config.privateKey !== 'sk_test_placeholder' &&
      this.config.merchantToken !== 'token_placeholder'
    );
  }

  /**
   * Obtener información de configuración (sin exponer keys)
   */
  getConfigInfo() {
    return {
      environment: this.config.environment,
      isConfigured: this.isConfigured(),
      publicKeySet: !!this.config.publicKey && this.config.publicKey !== 'pk_test_placeholder',
      privateKeySet:
        !!this.config.privateKey && this.config.privateKey !== 'sk_test_placeholder',
      merchantTokenSet:
        !!this.config.merchantToken && this.config.merchantToken !== 'token_placeholder',
      webhookSecretSet: !!this.config.webhookSecret,
    };
  }
}

export const pagoparService = new PagoparService();
