import { TaskStatus } from '../src/tasks/task-status.enum';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Task } from '../src/tasks/task.entity';
import { api, createDatabaseTestApp } from './database-test-app';

describe('Tasks (e2e, PostgreSQL)', () => {
  let app: INestApplication;
  let cleanup: (() => Promise<void>) | undefined;
  let projectId: string;

  beforeEach(async () => {
    const test = await createDatabaseTestApp();
    app = test.app;
    cleanup = test.cleanup;
    const project = await api(app)
      .post('/projects')
      .send({ name: 'Project' })
      .expect(201);
    projectId = project.body.id;
  });
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  async function create(
    payload = { title: 'Task', description: 'Description' },
  ) {
    const response = await api(app)
      .post(`/projects/${projectId}/tasks`)
      .send(payload)
      .expect(201);
    return response.body as Task;
  }
  function repository() {
    return app.get(DataSource).getRepository(Task);
  }

  it('creates, reads and deletes a task with a bodyless 204 response', async () => {
    const task = await create({
      title: '  Task  ',
      description: 'Description',
    });
    expect(task).toMatchObject({
      projectId,
      title: 'Task',
      description: 'Description',
      status: TaskStatus.TODO,
    });
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
    await api(app).get(`/tasks/${task.id}`).expect(200).expect(task);
    const deleted = await api(app).delete(`/tasks/${task.id}`).expect(204);
    expect(deleted.text).toBe('');
    expect(await repository().findOneBy({ id: task.id })).toBeNull();
    await api(app).get(`/tasks/${task.id}`).expect(404);
    await api(app).delete(`/tasks/${task.id}`).expect(404);
  });

  it.each([undefined, null, '', ' \t\n '])(
    'normalizes description %j during create and patch',
    async (description) => {
      const response = await api(app)
        .post(`/projects/${projectId}/tasks`)
        .send({ title: 'Task', description })
        .expect(201);
      expect(response.body.description).toBeNull();
      const task = await create();
      await api(app)
        .patch(`/tasks/${task.id}`)
        .send({ description })
        .expect(200);
      const stored = await repository().findOneByOrFail({ id: task.id });
      expect(stored.description).toBe(
        description === undefined ? 'Description' : null,
      );
    },
  );

  it('filters by project and sorts by creation time then ID descending', async () => {
    const first = await create();
    const second = await create();
    const third = await create();
    await repository().update([first.id, second.id], {
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    await repository().update(third.id, {
      createdAt: new Date('2026-01-02T00:00:00Z'),
    });
    const other = await api(app)
      .post('/projects')
      .send({ name: 'Other' })
      .expect(201);
    await api(app)
      .post(`/projects/${other.body.id}/tasks`)
      .send({ title: 'Other task' })
      .expect(201);
    const response = await api(app)
      .get(`/projects/${projectId}/tasks`)
      .expect(200);
    expect(response.body.map((task: Task) => task.id)).toEqual([
      third.id,
      ...[first.id, second.id].sort().reverse(),
    ]);
    const empty = await api(app)
      .post('/projects')
      .send({ name: 'Empty' })
      .expect(201);
    await api(app)
      .get(`/projects/${empty.body.id}/tasks`)
      .expect(200)
      .expect([]);
  });

  it('returns the persisted task with all updated fields', async () => {
    const task = await create();
    const response = await api(app)
      .patch(`/tasks/${task.id}`)
      .send({ title: ' New ', description: '   ', status: 'DoNe' })
      .expect(200);
    expect(response.body).toMatchObject({
      id: task.id,
      title: 'New',
      description: null,
      status: TaskStatus.DONE,
    });
    const fetched = await api(app).get(`/tasks/${task.id}`).expect(200);
    expect(response.body).toEqual(fetched.body);
    expect(await repository().findOneByOrFail({ id: task.id })).toMatchObject({
      title: 'New',
      description: null,
      status: TaskStatus.DONE,
    });
  });

  it.each(['todo', 'In_Progress', 'DONE'])(
    'normalizes status %s and preserves omitted fields',
    async (status) => {
      const task = await create();
      await api(app).patch(`/tasks/${task.id}`).send({ status }).expect(200);
      expect(await repository().findOneByOrFail({ id: task.id })).toMatchObject(
        {
          title: task.title,
          description: task.description,
          status: status.toUpperCase(),
        },
      );
    },
  );

  it('accepts an empty patch without modifying the record', async () => {
    const task = await create();
    await api(app).patch(`/tasks/${task.id}`).send({}).expect(200);
    const stored = await repository().findOneByOrFail({ id: task.id });
    expect(stored.updatedAt.toISOString()).toBe(task.updatedAt);
  });

  it.each([
    { title: null },
    { title: '   ' },
    { title: 42 },
    { title: 'x'.repeat(151) },
    { description: 42 },
    { description: 'x'.repeat(2001) },
    { status: null },
    { status: 'unknown' },
    { status: 42 },
  ])(
    'rejects invalid patch %j without changing the record',
    async (payload) => {
      const task = await create();
      const before = await repository().findOneByOrFail({ id: task.id });
      await api(app).patch(`/tasks/${task.id}`).send(payload).expect(400);
      expect(await repository().findOneByOrFail({ id: task.id })).toEqual(
        before,
      );
    },
  );

  it.each([
    {},
    { title: null },
    { title: '  ' },
    { title: 'x'.repeat(151) },
    { title: 'Task', description: 42 },
    { title: 'Task', description: 'x'.repeat(2001) },
  ])('rejects invalid creation %j', async (payload) => {
    await api(app)
      .post(`/projects/${projectId}/tasks`)
      .send(payload)
      .expect(400);
    expect(await repository().count()).toBe(0);
  });

  it('accepts title and description at their length limits', async () => {
    const task = await create({
      title: 'x'.repeat(150),
      description: 'x'.repeat(2000),
    });
    await api(app)
      .patch(`/tasks/${task.id}`)
      .send({ title: 'y'.repeat(150), description: 'y'.repeat(2000) })
      .expect(200);
  });

  it('returns 404 for missing projects and tasks', async () => {
    const id = randomUUID();
    await api(app).get(`/projects/${id}/tasks`).expect(404);
    await api(app)
      .post(`/projects/${id}/tasks`)
      .send({ title: 'Task' })
      .expect(404);
    await api(app).get(`/tasks/${id}`).expect(404);
    await api(app).patch(`/tasks/${id}`).send({ status: 'done' }).expect(404);
    await api(app).delete(`/tasks/${id}`).expect(404);
  });

  it('rejects malformed route IDs', async () => {
    await api(app).get('/projects/invalid/tasks').expect(400);
    await api(app)
      .post('/projects/invalid/tasks')
      .send({ title: 'Task' })
      .expect(400);
    await api(app).get('/tasks/invalid').expect(400);
    await api(app).patch('/tasks/invalid').send({ status: 'done' }).expect(400);
    await api(app).delete('/tasks/invalid').expect(400);
  });

  it('keeps all fields unchanged when the combined update fails', async () => {
    const task = await create();
    const before = await repository().findOneByOrFail({ id: task.id });
    // This constraint exists only in this test's disposable database.
    await app
      .get(DataSource)
      .query(
        `ALTER TABLE "tasks" ADD CONSTRAINT "test_reject_description" CHECK (description IS DISTINCT FROM 'rejected')`,
      );
    await api(app)
      .patch(`/tasks/${task.id}`)
      .send({ title: 'Must roll back', description: 'rejected' })
      .expect(500);
    expect(await repository().findOneByOrFail({ id: task.id })).toEqual(before);
  });

  it('returns each concurrent update result without changing omitted fields', async () => {
    const task = await create();
    const responses = await Promise.all(
      ['done', 'in_progress'].map((status) =>
        api(app).patch(`/tasks/${task.id}`).send({ status }).expect(200),
      ),
    );
    expect(responses.map((response) => response.body.status).sort()).toEqual([
      TaskStatus.DONE,
      TaskStatus.IN_PROGRESS,
    ]);
    for (const response of responses) {
      expect(response.body).toMatchObject({
        id: task.id,
        title: task.title,
        description: task.description,
      });
    }
    expect([TaskStatus.DONE, TaskStatus.IN_PROGRESS]).toContain(
      (await repository().findOneByOrFail({ id: task.id })).status,
    );
  });
});
