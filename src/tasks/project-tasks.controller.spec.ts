import { Test } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { ProjectTasksController } from './project-tasks.controller';
import { TasksService } from './tasks.service';

describe('ProjectTasksController (HTTP)', () => {
  let app: INestApplication;
  let service: { findByProject: jest.Mock; create: jest.Mock };
  const projectId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    service = { findByProject: jest.fn(), create: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [ProjectTasksController],
      providers: [{ provide: TasksService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves the project tasks route and preserves list order', async () => {
    const tasks = [
      { id: 'newer', projectId },
      { id: 'older', projectId },
    ];
    service.findByProject.mockResolvedValue(tasks);
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/tasks`)
      .expect(200)
      .expect(tasks);
    expect(service.findByProject).toHaveBeenCalledWith(projectId);
  });

  it('returns an empty array for a project without tasks', async () => {
    service.findByProject.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/tasks`)
      .expect(200)
      .expect([]);
  });

  it('rejects invalid UUIDs before calling the service', async () => {
    await request(app.getHttpServer())
      .get('/projects/invalid/tasks')
      .expect(400);
    expect(service.findByProject).not.toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist', async () => {
    service.findByProject.mockRejectedValue(
      new NotFoundException('Project was not found'),
    );
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/tasks`)
      .expect(404);
  });
  it('creates a task at the project tasks URL', async () => {
    const task = { id: 'task-id', projectId, title: 'Task' };
    service.create.mockResolvedValue(task);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .send({ title: 'Task' })
      .expect(201)
      .expect(task);
    expect(service.create).toHaveBeenCalledWith({ title: 'Task', projectId });
  });
});
