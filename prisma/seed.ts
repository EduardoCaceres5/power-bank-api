import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash para las contraseñas (Admin123456)
  const hashedPassword = await bcrypt.hash('Admin123456', 10);

  // Crear Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@powerbank.com' },
    update: {},
    create: {
      email: 'superadmin@powerbank.com',
      password: hashedPassword,
      fullName: 'Super Administrador',
      phone: '+1234567890',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log('✅ Super Admin created:', superAdmin.email);

  // Crear Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@powerbank.com' },
    update: {},
    create: {
      email: 'admin@powerbank.com',
      password: hashedPassword,
      fullName: 'Administrador',
      phone: '+1234567891',
      role: UserRole.ADMIN,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log('✅ Admin created:', admin.email);

  // Crear Usuario Regular
  const user = await prisma.user.upsert({
    where: { email: 'user@powerbank.com' },
    update: {},
    create: {
      email: 'user@powerbank.com',
      password: hashedPassword,
      fullName: 'Usuario Regular',
      phone: '+1234567892',
      role: UserRole.USER,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log('✅ User created:', user.email);

  console.log('\n📋 Usuarios creados:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('│ Email                     │ Password      │ Role        │');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('│ superadmin@powerbank.com  │ Admin123456   │ SUPER_ADMIN │');
  console.log('│ admin@powerbank.com       │ Admin123456   │ ADMIN       │');
  console.log('│ user@powerbank.com        │ Admin123456   │ USER        │');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✨ Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
