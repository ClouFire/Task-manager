import request from 'supertest';
import { DataSource } from 'typeorm';
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
    const createResponse = await api(app).post('/projects').send({ name: 'Test Project', description: 'A test project' }).expect(201);
    const projectId = createResponse.body.id;

    return api(app).get(`/projects/${projectId}`).expect(200).expect((res) => {
      expect(res.body.name).toBe('Test Project');
      expect(res.body.description).toBe('A test project');
    });
  });

  it('/projects/:id (GET)', async () => {
    const createResponse = await api(app).post('/projects').send({ name: 'Test Project', description: 'A test project' }).expect(201);
    const projectId = createResponse.body.id;

    return api(app).get(`/projects/${projectId}`).expect(200).expect((res) => {
      expect(res.body.name).toBe('Test Project');
      expect(res.body.description).toBe('A test project');
    });
  });

  it('/projects/:id (GET) - Not Found', () => {
    return api(app).get('/projects/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('/projects (POST) - Bad Request', () => {
    return api(app).post('/projects').send({ name: '      ', description: 'A test project' }).expect(400);
  });

  it('/projects (POST) - Bad Request for invalid description', () => {
    return api(app).post('/projects').send({ name: 'Test Project', description: 123 }).expect(400);
  });

  it('/projects (POST) - Bad Request for missing name', () => {
    return api(app).post('/projects').send({ description: 'A test project' }).expect(400);
  });

  it('/projects (POST) - Bad Request for null name', () => {
    return api(app).post('/projects').send({ name: null, description: 'A test project' }).expect(400);
  });

  it('/projects (POST) - Bad Request for undefined name', () => {
    return api(app).post('/projects').send({ name: undefined, description: 'A test project' }).expect(400);
  });

  it('/projects (GET) - Bad Request for invalid UUID', () => {
    return api(app).get('/projects/invalid-uuid').expect(400);
  });

  afterEach(async () => {
    await cleanup?.();
  });
});
