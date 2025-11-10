// Script para ver la respuesta completa de WsCharge
const axios = require('axios');

const WSCHARGE_API_URL = 'https://api.w-dian.cn/operate';
const WSCHARGE_OCODE = 'samuelcharge';
const WSCHARGE_USERNAME = 'admin';
const WSCHARGE_PASSWORD = '111111';

async function debugWsCharge() {
  try {
    // Login
    const loginResponse = await axios.post(
      `${WSCHARGE_API_URL}/auth/login`,
      { name: WSCHARGE_USERNAME, password: WSCHARGE_PASSWORD },
      { headers: { 'ocode': WSCHARGE_OCODE, 'Content-Type': 'application/json' } }
    );

    const token = loginResponse.data.data.token;
    console.log('✅ Login exitoso\n');

    // Obtener gabinetes
    const cabinetsResponse = await axios.get(
      `${WSCHARGE_API_URL}/equipment/index`,
      {
        headers: { 'ocode': WSCHARGE_OCODE, 'token': token },
        params: { page: 1, limit: 100 }
      }
    );

    console.log('📋 RESPUESTA COMPLETA DE GABINETES:');
    console.log(JSON.stringify(cabinetsResponse.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Respuesta:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugWsCharge();
