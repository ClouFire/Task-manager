import { DataSource } from 'typeorm';
import { Project } from '../src/projects/projects.entity';
import { INestApplication } from '@nestjs/common';
import { api, createDatabaseTestApp } from './database-test-app';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  let cleanup: (() => Promise<void>) | undefined;
  beforeEach(async () => {
    const test = await createDatabaseTestApp();
    app = test.app;
    cleanup = test.cleanup;
  });

  it('/ (GET)', () => {
    return api(app).get('/').expect(200).expect('Hello World!');
  });

  it('/projects (POST)', async () => {
    const createResponse = await api(app)
      .post('/projects')
      .send({ name: 'Test Project', description: 'A test project' })
      .expect(201);
    const projectId = createResponse.body.id;

    return api(app)
      .get(`/projects/${projectId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Test Project');
        expect(res.body.description).toBe('A test project');
      });
  });

  it('/projects/:id (GET)', async () => {
    const createResponse = await api(app)
      .post('/projects')
      .send({ name: 'Test Project', description: 'A test project' })
      .expect(201);
    const projectId = createResponse.body.id;

    return api(app)
      .get(`/projects/${projectId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Test Project');
        expect(res.body.description).toBe('A test project');
      });
  });

  it('/projects/:id (GET) - Not Found', () => {
    return api(app)
      .get('/projects/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('/projects (POST) - creates distinct UUIDs for two projects', async () => {
    const first = await api(app)
      .post('/projects')
      .send({ name: 'First project' })
      .expect(201);
    const second = await api(app)
      .post('/projects')
      .send({ name: 'Second project' })
      .expect(201);
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(first.body.id).toMatch(uuid);
    expect(second.body.id).toMatch(uuid);
    expect(first.body.id).not.toBe(second.body.id);

    for (const response of [first, second]) {
      await api(app)
        .get(`/projects/${response.body.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(response.body.id);
          expect(res.body.name).toBe(response.body.name);
        });
    }
  });

  it('/projects (POST) - accepts name and description at their length limits', async () => {
    const project = { name: 'n'.repeat(100), description: 'd'.repeat(500) };
    const response = await api(app).post('/projects').send(project).expect(201);

    expect(response.body).toMatchObject(project);
    await api(app)
      .get(`/projects/${response.body.id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject(project);
      });
  });

  it.each([
    ['blank name', { name: '      ', description: 'A test project' }],
    ['invalid description', { name: 'Test Project', description: 123 }],
    ['missing name', { description: 'A test project' }],
    ['null name', { name: null, description: 'A test project' }],
    ['undefined name', { name: undefined, description: 'A test project' }],
    ['101-character name', { name: 'n'.repeat(101) }],
    [
      '501-character description',
      { name: 'Test Project', description: 'd'.repeat(501) },
    ],
  ])(
    '/projects (POST) - rejects %s without creating a record',
    async (_scenario, payload) => {
      await api(app)
        .post('/projects')
        .send({ name: 'Existing project' })
        .expect(201);
      const repository = app.get(DataSource).getRepository(Project);
      const before = await repository.find();

      await api(app).post('/projects').send(payload).expect(400);

      expect(await repository.find()).toEqual(before);
    },
  );

  it('/projects (GET) - Bad Request for invalid UUID', () => {
    return api(app).get('/projects/invalid-uuid').expect(400);
  });

  afterEach(async () => {
    await cleanup?.();
  });
});
