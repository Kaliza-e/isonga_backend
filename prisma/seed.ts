import { PrismaClient, AreaLevel, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for Isonga Connect (Isonga C)...');

  // 1. Clean existing records (respecting foreign key order)
  await prisma.auditLog.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.notificationSubscription.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.residentProfile.deleteMany();
  await prisma.announcementTarget.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.administratorPermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.administrativeArea.deleteMany();
  await prisma.systemSetting.deleteMany();

  console.log('🧹 Cleaned all dummy and seeded records.');

  // 2. Seed System Settings
  await prisma.systemSetting.createMany({
    data: [
      { key: 'platform_name', value: 'Isonga Connect (Isonga C)' },
      { key: 'platform_version', value: '1.0.0' },
      { key: 'default_language', value: 'rw' },
      { key: 'country_code', value: '+250' },
    ],
  });

  // 3. Seed Authentic Rwanda Administrative Geography Hierarchy
  // Country: Rwanda
  const rwanda = await prisma.administrativeArea.create({
    data: {
      code: 'RW',
      name: 'Rwanda',
      level: AreaLevel.COUNTRY,
      path: '/rwanda',
    },
  });

  // Province: Kigali City (Umujyi wa Kigali)
  const kigali = await prisma.administrativeArea.create({
    data: {
      code: '01',
      name: 'City of Kigali',
      level: AreaLevel.PROVINCE,
      parentId: rwanda.id,
      path: `${rwanda.path}/kigali`,
    },
  });

  // Province: Northern Province
  const northern = await prisma.administrativeArea.create({
    data: {
      code: '02',
      name: 'Northern Province',
      level: AreaLevel.PROVINCE,
      parentId: rwanda.id,
      path: `${rwanda.path}/northern`,
    },
  });

  // Districts under Kigali
  const gasabo = await prisma.administrativeArea.create({
    data: {
      code: '0101',
      name: 'Gasabo District',
      level: AreaLevel.DISTRICT,
      parentId: kigali.id,
      path: `${kigali.path}/gasabo`,
    },
  });

  const nyarugenge = await prisma.administrativeArea.create({
    data: {
      code: '0102',
      name: 'Nyarugenge District',
      level: AreaLevel.DISTRICT,
      parentId: kigali.id,
      path: `${kigali.path}/nyarugenge`,
    },
  });

  const kicukiro = await prisma.administrativeArea.create({
    data: {
      code: '0103',
      name: 'Kicukiro District',
      level: AreaLevel.DISTRICT,
      parentId: kigali.id,
      path: `${kigali.path}/kicukiro`,
    },
  });

  // District under Northern Province
  const musanze = await prisma.administrativeArea.create({
    data: {
      code: '0201',
      name: 'Musanze District',
      level: AreaLevel.DISTRICT,
      parentId: northern.id,
      path: `${northern.path}/musanze`,
    },
  });

  // Sectors under Gasabo
  const kimironko = await prisma.administrativeArea.create({
    data: {
      code: '010101',
      name: 'Kimironko Sector',
      level: AreaLevel.SECTOR,
      parentId: gasabo.id,
      path: `${gasabo.path}/kimironko`,
    },
  });

  const remera = await prisma.administrativeArea.create({
    data: {
      code: '010102',
      name: 'Remera Sector',
      level: AreaLevel.SECTOR,
      parentId: gasabo.id,
      path: `${gasabo.path}/remera`,
    },
  });

  const kacyiru = await prisma.administrativeArea.create({
    data: {
      code: '010103',
      name: 'Kacyiru Sector',
      level: AreaLevel.SECTOR,
      parentId: gasabo.id,
      path: `${gasabo.path}/kacyiru`,
    },
  });

  // Cells under Kimironko
  const kimironkoCell = await prisma.administrativeArea.create({
    data: {
      code: '01010101',
      name: 'Kimironko Cell',
      level: AreaLevel.CELL,
      parentId: kimironko.id,
      path: `${kimironko.path}/kimironko-cell`,
    },
  });

  const gatsataCell = await prisma.administrativeArea.create({
    data: {
      code: '01010102',
      name: 'Gatsata Cell',
      level: AreaLevel.CELL,
      parentId: kimironko.id,
      path: `${kimironko.path}/gatsata-cell`,
    },
  });

  const nderaCell = await prisma.administrativeArea.create({
    data: {
      code: '01010103',
      name: 'Ndera Cell',
      level: AreaLevel.CELL,
      parentId: kimironko.id,
      path: `${kimironko.path}/ndera-cell`,
    },
  });

  // Villages under Kimironko Cell
  const reberoVillage = await prisma.administrativeArea.create({
    data: {
      code: '0101010101',
      name: 'Rebero Village',
      level: AreaLevel.VILLAGE,
      parentId: kimironkoCell.id,
      path: `${kimironkoCell.path}/rebero`,
    },
  });

  const izubaVillage = await prisma.administrativeArea.create({
    data: {
      code: '0101010102',
      name: 'Izuba Village',
      level: AreaLevel.VILLAGE,
      parentId: kimironkoCell.id,
      path: `${kimironkoCell.path}/izuba`,
    },
  });

  const ubumweVillage = await prisma.administrativeArea.create({
    data: {
      code: '0101010103',
      name: 'Ubumwe Village',
      level: AreaLevel.VILLAGE,
      parentId: kimironkoCell.id,
      path: `${kimironkoCell.path}/ubumwe`,
    },
  });

  console.log('🗺️ Seeded Rwanda Administrative Geography.');

  // 4. Create ONLY the Official Administrator
  const adminPasswordHash = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'kalizaesther5@gmail.com',
      phone: '+250788999888',
      phoneVerified: true,
      emailVerified: true,
      passwordHash: adminPasswordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      residentProfile: {
        create: {
          firstName: 'Esther',
          lastName: 'Kaliza',
          preferredLanguage: 'rw',
          area: { connect: { id: gasabo.id } },
          consentGiven: true,
          consentTimestamp: new Date(),
          consentVersion: 'v1.0',
        },
      },
      adminPermissions: {
        create: {
          areaId: gasabo.id,
          canPublish: true,
          canSchedule: true,
          canBroadcastEmergency: true,
        },
      },
    },
  });

  console.log(`👤 Created Administrator: ${admin.email} (Role: ${admin.role})`);
  console.log('🔒 Password: Password123!');
  console.log('✅ Clean database setup complete. No dummy residents or mock announcements created.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
