import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns the documented liveness envelope', async () => {
    // Issue #43 follow-up: /health now couples HTTP status to body
    // `status` (200/503). The e2e harness may not have a live Postgres /
    // PostGIS instance in the CI sandbox, so we tolerate both responses
    // and only assert the JSON contract.
    const res = await request(app.getHttpServer()).get('/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body).toMatchObject({
      status: expect.stringMatching(/^(ok|degraded)$/),
      timestamp: expect.any(String),
      services: expect.objectContaining({
        database: expect.objectContaining({
          status: expect.stringMatching(/^(ok|error)$/),
        }),
        postgis: expect.objectContaining({
          status: expect.stringMatching(/^(ok|error)$/),
        }),
      }),
    });
    // If the status code is 503, body.status must be 'degraded', and vice-versa.
    if (res.status === 200) {
      expect(res.body.status).toBe('ok');
    } else {
      expect(res.body.status).toBe('degraded');
    }
  });

  it('GET /health is served by the DB/PostGIS probe, never the static placeholder', async () => {
    // Regression guard for #429: AppController used to register a second
    // GET /health that returned a static `{ status: 'ok' }` body and raced
    // the real probe for the same route. That handler is gone, so the
    // response must always carry the `services` envelope the probe emits;
    // the static placeholder never has one.
    const res = await request(app.getHttpServer()).get('/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body).not.toEqual({ status: 'ok' });
    expect(res.body.services).toHaveProperty('database');
    expect(res.body.services).toHaveProperty('postgis');
  });
});
