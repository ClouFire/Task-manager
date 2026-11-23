import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task } from './task.entity';

describe('TasksController', () => {
  let controller: TasksController;
  let service: { create: jest.Mock; findById: jest.Mock };
  const id = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    service = { create: jest.fn(), findById: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: service }],
    }).compile();
    controller = module.get(TasksController);
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
