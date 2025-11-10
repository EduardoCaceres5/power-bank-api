// Script para agregar el gabinete manualmente
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addCabinet() {
  try {
    console.log('📦 Agregando gabinete GT042250704279...\n');

    const cabinet = await prisma.cabinet.create({
      data: {
        id: 'GT042250704279', // Cabinet ID es el campo id en el schema
        name: 'Gabinete PM8 Principal',
        status: 'OFFLINE', // Está offline en WsCharge
        location: 'Ubicación Principal',
        address: 'Dirección a configurar',
        latitude: null, // Configura después
        longitude: null, // Configura después
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Gabinete agregado exitosamente!');
    console.log('\n📋 Detalles:');
    console.log(`   ID: ${cabinet.id}`);
    console.log(`   Cabinet ID: ${cabinet.cabinetId}`);
    console.log(`   Nombre: ${cabinet.name}`);
    console.log(`   Estado: ${cabinet.status}`);
    console.log(`   Modelo: ${cabinet.model}`);

    console.log('\n📝 Próximos pasos:');
    console.log('   1. Abre el admin panel: http://localhost:5173');
    console.log('   2. Ve a Cabinets');
    console.log('   3. Deberías ver el gabinete (estará OFFLINE)');
    console.log('\n💡 Para que aparezca ONLINE:');
    console.log('   - Asegúrate que el gabinete físico esté conectado a internet');
    console.log('   - Verifica que esté configurado con tu OCODE: samuelcharge');
    console.log('   - Reinicia el gabinete si es necesario');
    console.log('   - Cuando envíe heartbeat a WsCharge, aparecerá online');

  } catch (error) {
    if (error.code === 'P2002') {
      console.log('⚠️  El gabinete ya existe en la base de datos');
      console.log('   Puedes verlo en: http://localhost:5173/cabinets');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

addCabinet();
