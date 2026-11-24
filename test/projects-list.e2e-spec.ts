import { INestApplication } from '@nestjs/common';
import { api, createDatabaseTestApp } from './database-test-app';

describe('Project list (e2e)', () => {
  let app: INestApplication;
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    const test = await createDatabaseTestApp();
    app = test.app;
    cleanup = test.cleanup;
  });

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('returns an empty array when there are no projects', async () => {
    const response = await api(app).get('/projects').expect(200);

    expect(response.body).toEqual([]);
  });

  it('returns all created projects without requiring a particular order', async () => {
    const first = await api(app)
      .post('/projects')
      .send({ name: 'First', description: 'First description' })
      .expect(201);
    const second = await api(app)
      .post('/projects')
      .send({ name: 'Second' })
      .expect(201);

    const response = await api(app).get('/projects').expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body).toEqual(
      expect.arrayContaining([first.body, second.body]),
    );
  });

  it('omits deleted projects while preserving the remaining projects', async () => {
    const deleted = await api(app)
      .post('/projects')
      .send({ name: 'Delete me' })
      .expect(201);
    const retained = await api(app)
      .post('/projects')
      .send({ name: 'Keep me' })
      .expect(201);

    await api(app).delete(`/projects/${deleted.body.id}`).expect(204);

    const response = await api(app).get('/projects').expect(200);
    expect(response.body).toEqual([retained.body]);

    await api(app).delete(`/projects/${retained.body.id}`).expect(204);
    const empty = await api(app).get('/projects').expect(200);
    expect(empty.body).toEqual([]);
  });
});
