import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Project } from '../src/projects/projects.entity';
import { Task } from '../src/tasks/task.entity';
import { api, createDatabaseTestApp } from './database-test-app';

describe('Project deletion (e2e)', () => {
  let app: INestApplication;
  let cleanup: (() => Promise<void>) | undefined;
  let id: string;

  beforeEach(async () => {
    const test = await createDatabaseTestApp();
    app = test.app;
    cleanup = test.cleanup;
    const response = await api(app)
      .post('/projects')
      .send({ name: 'Project' })
      .expect(201);
    id = response.body.id;
  });

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('returns 204 with no body and removes the project from the database', async () => {
    const response = await api(app).delete(`/projects/${id}`).expect(204);
    expect(response.text).toBe('');
    expect(
      await app.get(DataSource).getRepository(Project).existsBy({ id }),
    ).toBe(false);
    await api(app).get(`/projects/${id}`).expect(404);
  });

  it('returns 404 for a project absent from the database without modifying other projects', async () => {
    const missingId = randomUUID();
    const projects = app.get(DataSource).getRepository(Project);
    expect(await projects.existsBy({ id: missingId })).toBe(false);
    const before = await projects.find();

    const response = await api(app).delete(`/projects/${missingId}`).expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Project was not found',
    });
    expect(await projects.find()).toEqual(before);
  });

  it('returns 404 when deleting a project a second time', async () => {
    await api(app).delete(`/projects/${id}`).expect(204);
    const response = await api(app).delete(`/projects/${id}`).expect(404);
    expect(response.body.statusCode).toBe(404);
  });

  it('rejects invalid UUIDs without deleting projects', async () => {
    await api(app).delete('/projects/invalid').expect(400);
    await api(app).get(`/projects/${id}`).expect(200);
  });

  it('preserves the project and its task on conflict, then allows deletion after removing the task', async () => {
    const response = await api(app)
      .post(`/projects/${id}/tasks`)
      .send({ title: 'Task' })
      .expect(201);
    const projects = app.get(DataSource).getRepository(Project);
    const tasks = app.get(DataSource).getRepository(Task);
    const project = await projects.findOneByOrFail({ id });
    const task = await tasks.findOneByOrFail({ id: response.body.id });

    await api(app).delete(`/projects/${id}`).expect(409);
    expect(await projects.findOneByOrFail({ id })).toEqual(project);
    expect(await tasks.findOneByOrFail({ id: task.id })).toEqual(task);

    await api(app).delete(`/tasks/${task.id}`).expect(204);
    await api(app).delete(`/projects/${id}`).expect(204);
  });

  it('does not prevent deleting an empty project when another project has tasks', async () => {
    const other = await api(app)
      .post('/projects')
      .send({ name: 'Other' })
      .expect(201);
    const task = await api(app)
      .post(`/projects/${other.body.id}/tasks`)
      .send({ title: 'Other task' })
      .expect(201);
    await api(app).delete(`/projects/${id}`).expect(204);
    await api(app).get(`/projects/${other.body.id}`).expect(200);
    expect(
      await app
        .get(DataSource)
        .getRepository(Task)
        .existsBy({ id: task.body.id }),
    ).toBe(true);
  });
});
