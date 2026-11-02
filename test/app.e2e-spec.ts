import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Isonga Connect (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication<App>;
  let superAdminToken: string;
  let reberoVillageId: string;

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
    expect(rwanda.level).toBe('COUNTRY');

    const rebero = response.body.find((a: any) => a.name === 'Rebero');
    if (rebero) {
      reberoVillageId = rebero.id;
    }
  });

  it('/api/v1/auth/login (POST) - Login with seeded Super Admin', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: '+250788000001',
        password: 'Password123!',
      })
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user.role).toBe('SUPER_ADMIN');
    superAdminToken = response.body.accessToken;
  });

  it('/api/v1/auth/me (GET) - Retrieve authenticated admin profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(response.body.phone).toBe('+250788000001');
    expect(response.body.role).toBe('SUPER_ADMIN');
  });

  it('/api/v1/auth/register (POST) & verify-otp - Resident registration flow', async () => {
    const testPhone = `+25078${Math.floor(1000000 + Math.random() * 9000000)}`;

    // 1. Register resident
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

    expect(regRes.body).toHaveProperty('userId');
    expect(regRes.body).toHaveProperty('devOtp');
    const otp = regRes.body.devOtp;

    // 2. Verify OTP
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        phone: testPhone,
        otp,
      })
      .expect(200);

    expect(verifyRes.body).toHaveProperty('accessToken');
    expect(verifyRes.body.user.status).toBe('ACTIVE');
    const residentToken = verifyRes.body.accessToken;

    // 3. Resident tries to access admin-only endpoint /api/v1/users (Should receive 403 Forbidden)
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${residentToken}`)
      .expect(403);
  });
});
