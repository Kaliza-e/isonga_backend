import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Isonga Connect (e2e)', () => {
  let app: INestApplication<App>;

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
    // Find Rwanda root
    const rwanda = response.body.find((a: any) => a.code === 'RW');
    expect(rwanda).toBeDefined();
    expect(rwanda.level).toBe('COUNTRY');
  });

  it('/api/v1/areas (GET) - Filter by level PROVINCE', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/areas?level=PROVINCE')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.every((a: any) => a.level === 'PROVINCE')).toBe(true);
  });

  it('/api/v1/areas (POST) - Reject invalid hierarchy (e.g. SECTOR directly under PROVINCE)', async () => {
    // Fetch Kigali province
    const kigaliRes = await request(app.getHttpServer()).get('/api/v1/areas?level=PROVINCE');
    const kigali = kigaliRes.body[0];

    const response = await request(app.getHttpServer())
      .post('/api/v1/areas')
      .send({
        code: 'TEST999',
        name: 'Invalid Sector',
        level: 'SECTOR', // A Sector must have a District as parent, NOT a Province!
        parentId: kigali.id,
      })
      .expect(400);

    expect(response.body.message).toMatch(/Geographical hierarchy violation/);
  });
});
