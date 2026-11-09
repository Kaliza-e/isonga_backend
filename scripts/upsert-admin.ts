import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'kalizaesther5@gmail.com';
  const password = process.argv[3] || 'Password123!';
  const phone = process.argv[4] || '+250788999888';

  console.log(`Checking / Creating Admin user: ${email}...`);

  // Check if root country or province area exists
  let area = await prisma.administrativeArea.findFirst({
    where: { level: 'DISTRICT' },
  });

  if (!area) {
    area = await prisma.administrativeArea.findFirst();
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }],
    },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        phoneVerified: true,
        emailVerified: true,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    console.log(`✅ Updated existing user ${updated.email} to SUPER_ADMIN with password "${password}".`);
  } else {
    const created = await prisma.user.create({
      data: {
        email,
        phone,
        phoneVerified: true,
        emailVerified: true,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        residentProfile: area
          ? {
              create: {
                firstName: 'Esther',
                lastName: 'Kaliza',
                preferredLanguage: 'rw',
                area: { connect: { id: area.id } },
                consentGiven: true,
                consentTimestamp: new Date(),
                consentVersion: 'v1.0',
              },
            }
          : undefined,
      },
    });
    console.log(`✅ Created new SUPER_ADMIN user: ${created.email} (${created.phone}) with password "${password}".`);
  }

  // Display all users in database
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      status: true,
    },
  });

  console.log('\n📋 Current Users in Database:');
  console.table(allUsers);
}

main()
  .catch((e) => {
    console.error('Error upserting admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
