import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Project } from '../src/projects/projects.entity';
import { Task } from '../src/tasks/task.entity';
import { api, createDatabaseTestApp } from './database-test-app';

describe('Project update (e2e)', () => {
  let app: INestApplication;
  let cleanup: (() => Promise<void>) | undefined;
  let id: string;
  beforeEach(async () => {
    const test = await createDatabaseTestApp();
    app = test.app;
    cleanup = test.cleanup;
    const response = await api(app)
      .post('/projects')
      .send({ name: 'Original', description: 'Original description' })
      .expect(201);
    id = response.body.id;
  });
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });
  function repository() {
    return app.get(DataSource).getRepository(Project);
  }

  it.each([
    [{ name: ' New ' }, 'New', 'Original description'],
    [{ description: 'New description' }, 'Original', 'New description'],
    [{ name: ' New ', description: 'Both' }, 'New', 'Both'],
    [{ description: null }, 'Original', null],
    [{ description: '' }, 'Original', ''],
    [{ name: ' x ', description: 'd'.repeat(500) }, 'x', 'd'.repeat(500)],
    [
      { name: ' ' + 'n'.repeat(100) + ' ' },
      'n'.repeat(100),
      'Original description',
    ],
  ])('patches only supplied fields: %j', async (payload, name, description) => {
    const before = await repository().findOneByOrFail({ id });
    const response = await api(app)
      .patch(`/projects/${id}`)
      .send(payload)
      .expect(200);
    const stored = await repository().findOneByOrFail({ id });
    expect(response.body).toEqual({
      id,
      name,
      description,
      createdAt: before.createdAt.toISOString(),
      updatedAt: stored.updatedAt.toISOString(),
    });
    expect(stored).toMatchObject({ name, description });
    expect(stored.updatedAt.getTime()).toBeGreaterThanOrEqual(
      before.updatedAt.getTime(),
    );
    const fetched = await api(app).get(`/projects/${id}`).expect(200);
    expect(response.body).toEqual(fetched.body);
  });

  it('does not modify a project for an empty patch', async () => {
    const before = await repository().findOneByOrFail({ id });
    const response = await api(app)
      .patch(`/projects/${id}`)
      .send({})
      .expect(200);
    expect(response.body).toEqual({
      id: before.id,
      name: before.name,
      description: before.description,
      createdAt: before.createdAt.toISOString(),
      updatedAt: before.updatedAt.toISOString(),
    });
    expect(await repository().findOneByOrFail({ id })).toEqual(before);
  });

  it.each([
    { name: null },
    { name: '' },
    { name: '  ' },
    { name: 42 },
    { name: [] },
    { name: 'n'.repeat(101) },
    { description: 42 },
    { description: {} },
    { description: 'd'.repeat(501) },
    { name: 'Valid', description: 42 },
  ])('rejects invalid data without persisting changes: %j', async (payload) => {
    const before = await repository().findOneByOrFail({ id });
    await api(app).patch(`/projects/${id}`).send(payload).expect(400);
    expect(await repository().findOneByOrFail({ id })).toEqual(before);
  });

  it('returns 404 for missing projects, including empty patches', async () => {
    const missing = randomUUID();
    await api(app)
      .patch(`/projects/${missing}`)
      .send({ name: 'New' })
      .expect(404);
    await api(app).patch(`/projects/${missing}`).send({}).expect(404);
  });

  it('rejects invalid UUIDs', async () => {
    await api(app).patch('/projects/invalid').send({ name: 'New' }).expect(400);
  });

  it('does not change tasks when updating the project', async () => {
    const response = await api(app)
      .post(`/projects/${id}/tasks`)
      .send({ title: 'Task', description: 'Task description' })
      .expect(201);
    const tasks = app.get(DataSource).getRepository(Task);
    const before = await tasks.findOneByOrFail({ id: response.body.id });
    await api(app)
      .patch(`/projects/${id}`)
      .send({ name: 'New', description: null })
      .expect(200);
    expect(await tasks.findOneByOrFail({ id: before.id })).toEqual(before);
  });
});
