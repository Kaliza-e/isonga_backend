import { PrismaClient, AreaLevel, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for Isonga Connect (Isonga C)...');

  // 1. Clean existing test data (respecting foreign key constraints)
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

  console.log('🧹 Cleaned existing records.');

  // 2. Seed System Settings
  await prisma.systemSetting.createMany({
    data: [
      { key: 'platform_name', value: 'Isonga Connect (Isonga C)' },
      { key: 'platform_version', value: '1.0.0' },
      { key: 'default_language', value: 'rw' },
      { key: 'country_code', value: '+250' },
    ],
  });

  // 3. Seed Rwanda Administrative Hierarchy
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

  // Province: Northern Province (Intara y'Amajyaruguru)
  const northern = await prisma.administrativeArea.create({
    data: {
      code: '02',
      name: 'Northern Province',
      level: AreaLevel.PROVINCE,
      parentId: rwanda.id,
      path: `${rwanda.path}/northern`,
    },
  });

  // District: Gasabo (under Kigali)
  const gasabo = await prisma.administrativeArea.create({
    data: {
      code: '0101',
      name: 'Gasabo',
      level: AreaLevel.DISTRICT,
      parentId: kigali.id,
      path: `${kigali.path}/gasabo`,
    },
  });

  // District: Nyarugenge (under Kigali)
  const nyarugenge = await prisma.administrativeArea.create({
    data: {
      code: '0102',
      name: 'Nyarugenge',
      level: AreaLevel.DISTRICT,
      parentId: kigali.id,
      path: `${kigali.path}/nyarugenge`,
    },
  });

  // District: Musanze (under Northern Province)
  const musanze = await prisma.administrativeArea.create({
    data: {
      code: '0201',
      name: 'Musanze',
      level: AreaLevel.DISTRICT,
      parentId: northern.id,
      path: `${northern.path}/musanze`,
    },
  });

  // Sector: Remera (under Gasabo)
  const remera = await prisma.administrativeArea.create({
    data: {
      code: '010101',
      name: 'Remera',
      level: AreaLevel.SECTOR,
      parentId: gasabo.id,
      path: `${gasabo.path}/remera`,
    },
  });

  // Sector: Kimironko (under Gasabo)
  const kimironko = await prisma.administrativeArea.create({
    data: {
      code: '010102',
      name: 'Kimironko',
      level: AreaLevel.SECTOR,
      parentId: gasabo.id,
      path: `${gasabo.path}/kimironko`,
    },
  });

  // Sector: Nyamirambo (under Nyarugenge)
  const nyamirambo = await prisma.administrativeArea.create({
    data: {
      code: '010201',
      name: 'Nyamirambo',
      level: AreaLevel.SECTOR,
      parentId: nyarugenge.id,
      path: `${nyarugenge.path}/nyamirambo`,
    },
  });

  // Cell: Rukiri I (under Remera)
  const rukiri1 = await prisma.administrativeArea.create({
    data: {
      code: '01010101',
      name: 'Rukiri I',
      level: AreaLevel.CELL,
      parentId: remera.id,
      path: `${remera.path}/rukiri-1`,
    },
  });

  // Cell: Rukiri II (under Remera)
  const rukiri2 = await prisma.administrativeArea.create({
    data: {
      code: '01010102',
      name: 'Rukiri II',
      level: AreaLevel.CELL,
      parentId: remera.id,
      path: `${remera.path}/rukiri-2`,
    },
  });

  // Village: Rebero (under Rukiri I)
  const reberoVillage = await prisma.administrativeArea.create({
    data: {
      code: '0101010101',
      name: 'Rebero',
      level: AreaLevel.VILLAGE,
      parentId: rukiri1.id,
      path: `${rukiri1.path}/rebero`,
    },
  });

  // Village: Izuba (under Rukiri I)
  const izubaVillage = await prisma.administrativeArea.create({
    data: {
      code: '0101010102',
      name: 'Izuba',
      level: AreaLevel.VILLAGE,
      parentId: rukiri1.id,
      path: `${rukiri1.path}/izuba`,
    },
  });

  // Village: Ubumwe (under Rukiri II)
  const ubumweVillage = await prisma.administrativeArea.create({
    data: {
      code: '0101010201',
      name: 'Ubumwe',
      level: AreaLevel.VILLAGE,
      parentId: rukiri2.id,
      path: `${rukiri2.path}/ubumwe`,
    },
  });

  console.log('🗺️ Seeded Rwanda Administrative hierarchy (Country down to Villages).');

  // 4. Seed Users & Administrators
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // Super Administrator
  const superAdmin = await prisma.user.create({
    data: {
      phone: '+250788000001',
      phoneVerified: true,
      email: 'superadmin@isonga.gov.rw',
      emailVerified: true,
      passwordHash: defaultPasswordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      residentProfile: {
        create: {
          firstName: 'Jean',
          lastName: 'Mugabo',
          preferredLanguage: 'rw',
          areaId: gasabo.id,
          consentGiven: true,
          consentTimestamp: new Date(),
          consentVersion: 'v1.0',
        },
      },
    },
  });

  // District Administrator (Gasabo District)
  const districtAdmin = await prisma.user.create({
    data: {
      phone: '+250788000002',
      phoneVerified: true,
      email: 'gasabo.admin@isonga.gov.rw',
      emailVerified: true,
      passwordHash: defaultPasswordHash,
      role: UserRole.DISTRICT_ADMIN,
      status: UserStatus.ACTIVE,
      residentProfile: {
        create: {
          firstName: 'Marie',
          lastName: 'Uwase',
          preferredLanguage: 'rw',
          areaId: gasabo.id,
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
          grantedById: superAdmin.id,
        },
      },
    },
  });

  // Sector Administrator (Remera Sector)
  const sectorAdmin = await prisma.user.create({
    data: {
      phone: '+250788000003',
      phoneVerified: true,
      email: 'remera.admin@isonga.gov.rw',
      emailVerified: true,
      passwordHash: defaultPasswordHash,
      role: UserRole.SECTOR_ADMIN,
      status: UserStatus.ACTIVE,
      residentProfile: {
        create: {
          firstName: 'Emmanuel',
          lastName: 'Karekezi',
          preferredLanguage: 'rw',
          areaId: remera.id,
          consentGiven: true,
          consentTimestamp: new Date(),
          consentVersion: 'v1.0',
        },
      },
      adminPermissions: {
        create: {
          areaId: remera.id,
          canPublish: true,
          canSchedule: true,
          canBroadcastEmergency: false,
          grantedById: districtAdmin.id,
        },
      },
    },
  });

  // Cell Administrator (Rukiri I Cell)
  const cellAdmin = await prisma.user.create({
    data: {
      phone: '+250788000004',
      phoneVerified: true,
      email: 'rukiri1.admin@isonga.gov.rw',
      emailVerified: true,
      passwordHash: defaultPasswordHash,
      role: UserRole.CELL_ADMIN,
      status: UserStatus.ACTIVE,
      residentProfile: {
        create: {
          firstName: 'Claudine',
          lastName: 'Mukamana',
          preferredLanguage: 'rw',
          areaId: rukiri1.id,
          consentGiven: true,
          consentTimestamp: new Date(),
          consentVersion: 'v1.0',
        },
      },
      adminPermissions: {
        create: {
          areaId: rukiri1.id,
          canPublish: true,
          canSchedule: true,
          canBroadcastEmergency: false,
          grantedById: sectorAdmin.id,
        },
      },
    },
  });

  // Sample Residents (Rebero Village & Izuba Village)
  const resident1 = await prisma.user.create({
    data: {
      phone: '+250788111222',
      phoneVerified: true,
      email: 'resident1@example.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.RESIDENT,
      status: UserStatus.ACTIVE,
      residentProfile: {
        create: {
          firstName: 'Patrick',
          lastName: 'Habimana',
          preferredLanguage: 'rw',
          areaId: reberoVillage.id,
          consentGiven: true,
          consentTimestamp: new Date(),
          consentVersion: 'v1.0',
          preference: {
            create: {
              smsEnabled: true,
              pushEnabled: true,
              inAppEnabled: true,
              communityMeetings: true,
              umuganda: true,
              publicServices: true,
              healthInfo: true,
              education: true,
              administrativeNotice: true,
              communityEvents: true,
            },
          },
        },
      },
    },
  });

  const resident2 = await prisma.user.create({
    data: {
      phone: '+250788333444',
      phoneVerified: true,
      passwordHash: defaultPasswordHash,
      role: UserRole.RESIDENT,
      status: UserStatus.ACTIVE,
      residentProfile: {
        create: {
          firstName: 'Aline',
          lastName: 'Gisa',
          preferredLanguage: 'rw',
          areaId: izubaVillage.id,
          consentGiven: true,
          consentTimestamp: new Date(),
          consentVersion: 'v1.0',
          preference: {
            create: {
              smsEnabled: true,
              pushEnabled: false,
              inAppEnabled: true,
              communityMeetings: true,
              umuganda: true,
              publicServices: false,
              healthInfo: true,
              education: false,
              administrativeNotice: true,
              communityEvents: true,
            },
          },
        },
      },
    },
  });

  console.log('👥 Seeded Users with Roles & Permissions:');
  console.log('   - Super Admin:       +250788000001 (superadmin@isonga.gov.rw)');
  console.log('   - District Admin:    +250788000002 (Gasabo District)');
  console.log('   - Sector Admin:      +250788000003 (Remera Sector)');
  console.log('   - Cell Admin:        +250788000004 (Rukiri I Cell)');
  console.log('   - Resident 1:        +250788111222 (Rebero Village)');
  console.log('   - Resident 2:        +250788333444 (Izuba Village)');
  console.log('   (Default password for all test accounts: Password123!)');
  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
