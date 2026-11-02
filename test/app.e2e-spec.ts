import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Isonga Connect (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication<App>;
  let superAdminToken: string;
  let remeraAdminToken: string;
  let reberoVillageId: string;
  let remeraAreaId: string;
  let musanzeAreaId: string;
  let residentToken: string;
  let publishedAnnouncementId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/api/v1 (GET) - Root greeting', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/v1/health (GET) - Health check reports DB up', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body.checks.database.status).toBe('up');
  });

  it('/api/v1/areas (GET) - Retrieve seeded administrative areas', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/areas')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    const rwanda = response.body.find((a: any) => a.code === 'RW');
    expect(rwanda).toBeDefined();

    const rebero = response.body.find((a: any) => a.name === 'Rebero');
    if (rebero) reberoVillageId = rebero.id;

    const remera = response.body.find((a: any) => a.name === 'Remera');
    if (remera) remeraAreaId = remera.id;

    const musanze = response.body.find((a: any) => a.name === 'Musanze');
    if (musanze) musanzeAreaId = musanze.id;
  });

  it('/api/v1/auth/login (POST) - Login with seeded Super Admin and Sector Admin', async () => {
    // 1. Super Admin
    const superRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: '+250788000001',
        password: 'Password123!',
      })
      .expect(200);

    superAdminToken = superRes.body.accessToken;

    // 2. Sector Admin (Remera Sector)
    const sectorRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: '+250788000003',
        password: 'Password123!',
      })
      .expect(200);

    remeraAdminToken = sectorRes.body.accessToken;
  });

  it('/api/v1/auth/register (POST) & verify-otp - Resident registration flow', async () => {
    const testPhone = `+25078${Math.floor(1000000 + Math.random() * 9000000)}`;

    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phone: testPhone,
        password: 'Password123!',
        firstName: 'Jean',
        lastName: 'Baptiste',
        areaId: reberoVillageId,
        consentGiven: true,
      })
      .expect(201);

    const otp = regRes.body.devOtp;

    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        phone: testPhone,
        otp,
      })
      .expect(200);

    residentToken = verifyRes.body.accessToken;
  });

  it('/api/v1/announcements/preview (POST) - Calculate eligible recipients', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/announcements/preview')
      .set('Authorization', `Bearer ${remeraAdminToken}`)
      .send({
        areaIds: [remeraAreaId],
        includeSubordinates: true,
        category: 'UMUGANDA',
      })
      .expect(200);

    expect(response.body).toHaveProperty('totalEligible');
    expect(response.body).toHaveProperty('smsEligible');
    expect(response.body.targetAreaNames).toContain('Remera');
  });

  it('/api/v1/announcements (POST) - Enforce geographical scope on announcement creation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${remeraAdminToken}`)
      .send({
        title: 'Unauthorized Out-of-Scope Announcement',
        content: 'Should be rejected',
        category: 'ADMINISTRATIVE_NOTICES',
        targetAreaIds: [musanzeAreaId],
      })
      .expect(403);
  });

  it('/api/v1/announcements (POST) & publish - Create and publish announcement in scope', async () => {
    // 1. Create draft in Remera
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${remeraAdminToken}`)
      .send({
        title: 'Itangazo ry Umuganda Rusange',
        content: 'Baturage ba Remera, umuganda uzaba kuwa gatandatu.',
        category: 'UMUGANDA',
        targetAreaIds: [remeraAreaId],
        includeSubordinates: true,
      })
      .expect(201);

    publishedAnnouncementId = createRes.body.id;
    expect(createRes.body.status).toBe('DRAFT');

    // 2. Publish announcement
    const pubRes = await request(app.getHttpServer())
      .post(`/api/v1/announcements/${publishedAnnouncementId}/publish`)
      .set('Authorization', `Bearer ${remeraAdminToken}`)
      .expect(200);

    expect(pubRes.body.announcement.status).toBe('PUBLISHED');
    expect(pubRes.body.eligibleRecipients).toBeGreaterThan(0);
    expect(pubRes.body).toHaveProperty('dispatch');

    // 3. Resident in Rebero Village (under Remera) checks feed
    const feedRes = await request(app.getHttpServer())
      .get('/api/v1/announcements/feed')
      .set('Authorization', `Bearer ${residentToken}`)
      .expect(200);

    expect(Array.isArray(feedRes.body)).toBe(true);
    const found = feedRes.body.find((a: any) => a.id === publishedAnnouncementId);
    expect(found).toBeDefined();
    expect(found.title).toBe('Itangazo ry Umuganda Rusange');
  });

  it('/api/v1/notifications/webhooks/sms (POST) - Ingest carrier DLR', async () => {
    const dlrRes = await request(app.getHttpServer())
      .post('/api/v1/notifications/webhooks/sms')
      .send({
        messageId: 'mock_provider_ref_test',
        status: 'DELIVERED',
      })
      .expect(200);

    expect(dlrRes.body).toHaveProperty('received', true);
  });

  it('/api/v1/analytics/overview (GET) - Admin analytics dashboard', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('announcements');
    expect(response.body.announcements.published).toBeGreaterThan(0);
    expect(response.body).toHaveProperty('residents');
    expect(response.body).toHaveProperty('notifications');
  });

  it('/api/v1/analytics/channels (GET) - Multi-channel delivery breakdown', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/analytics/channels')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(3); // SMS, PUSH, IN_APP
  });

  it('/api/v1/audit/logs (GET) - Super Admin audit trail', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('action');
    expect(response.body[0]).toHaveProperty('resource');
  });
});
