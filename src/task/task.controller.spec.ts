import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { Task } from './task.entity';

describe('TaskController', () => {
  let controller: TaskController;
  let service: { create: jest.Mock; findById: jest.Mock };
  const id = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    service = { create: jest.fn(), findById: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: service }],
    }).compile();
    controller = module.get(TaskController);
  });

  it('passes body and route project ID to creation and returns the saved task', async () => {
    const task = Object.assign(new Task(), { id, title: 'Task' });
    service.create.mockResolvedValue(task);
    await expect(controller.create({ title: 'Task' }, id)).resolves.toBe(task);
    expect(service.create).toHaveBeenCalledWith({
      title: 'Task',
      projectId: id,
    });
  });

  it('returns an existing task', async () => {
    const task = Object.assign(new Task(), { id });
    service.findById.mockResolvedValue(task);
    await expect(controller.search(id)).resolves.toBe(task);
    expect(service.findById).toHaveBeenCalledWith(id);
  });

  it('returns 404 for a missing task', async () => {
    service.findById.mockResolvedValue(null);
    await expect(controller.search(id)).rejects.toThrow(NotFoundException);
  });

  it('preserves lookup errors', async () => {
    const error = new Error('Database unavailable');
    service.findById.mockRejectedValue(error);
    await expect(controller.search(id)).rejects.toBe(error);
  });
});
