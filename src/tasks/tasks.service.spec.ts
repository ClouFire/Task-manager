import { QueryFailedError } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { ProjectsService } from '../projects/projects.service';

describe('TasksService', () => {
  let service: TasksService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
  };
  let projectsService: { findById: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
    };
    projectsService = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: repository },
        { provide: ProjectsService, useValue: projectsService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates and returns a task when the project exists', async () => {
    const dto = {
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Test task',
      description: 'Task description',
    };
    const task = Object.assign(new Task(), dto);
    const savedTask = Object.assign(new Task(), task, { id: 'task-id' });
    projectsService.findById.mockResolvedValue({ id: dto.projectId });
    repository.create.mockReturnValue(task);
    repository.save.mockResolvedValue(savedTask);

    await expect(service.create(dto)).resolves.toBe(savedTask);

    expect(projectsService.findById).toHaveBeenCalledWith(dto.projectId);
    expect(repository.create).toHaveBeenCalledWith(dto);
    expect(repository.save).toHaveBeenCalledWith(task);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('throws 404 without creating or saving a task when the project is missing', async () => {
    const dto = {
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Test task',
    };
    projectsService.findById.mockResolvedValue(null);

    await expect(service.create(dto)).rejects.toThrow(NotFoundException);

    expect(projectsService.findById).toHaveBeenCalledWith(dto.projectId);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
  it.each([undefined, null, '', '   ', '\t\n'])(
    'normalizes blank description %j to null',
    async (description) => {
      projectsService.findById.mockResolvedValue({});
      await service.create({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: ' Task ',
        description,
      });
      expect(repository.create).toHaveBeenCalledWith({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Task',
        description: null,
      });
    },
  );

  it('validates direct service calls before accessing the database', async () => {
    await expect(
      service.create({ projectId: 'invalid', title: '   ' }),
    ).rejects.toThrow(BadRequestException);
    expect(projectsService.findById).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it.each(['FK_task_project', 'FK_3797a20ef5553ae87af126bc2fe'])(
    'returns 404 for project foreign key violation %s',
    async (constraint) => {
      projectsService.findById.mockResolvedValue({});
      const error = new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('FK violation'), { code: '23503', constraint }),
      );
      repository.save.mockRejectedValue(error);
      await expect(
        service.create({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Task',
        }),
      ).rejects.toThrow(NotFoundException);
    },
  );

  it.each([
    new Error('Connection failed'),
    new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('Other FK'), {
        code: '23503',
        constraint: 'other_fk',
      }),
    ),
    new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('Other error'), {
        code: '23505',
        constraint: 'FK_task_project',
      }),
    ),
  ])('preserves unrelated save errors: %s', async (error) => {
    projectsService.findById.mockResolvedValue({});
    repository.save.mockRejectedValue(error);
    await expect(
      service.create({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Task',
      }),
    ).rejects.toBe(error);
  });
  describe('findById', () => {
    it.each([null, Object.assign(new Task(), { id: 'task-id' })])(
      'returns lookup result %j',
      async (task) => {
        repository.findOneBy.mockResolvedValue(task);
        await expect(service.findById('task-id')).resolves.toBe(task);
        expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'task-id' });
      },
    );
  });

  describe('findByProject', () => {
    const projectId = '550e8400-e29b-41d4-a716-446655440000';

    it.each([[[]], [[Object.assign(new Task(), { projectId })]]])(
      'returns project tasks %j',
      async (tasks) => {
        projectsService.findById.mockResolvedValue({ id: projectId });
        repository.find.mockResolvedValue(tasks);
        await expect(service.findByProject(projectId)).resolves.toBe(tasks);
        expect(projectsService.findById).toHaveBeenCalledWith(projectId);
        expect(repository.find).toHaveBeenCalledWith({
          where: { projectId },
          order: { createdAt: 'DESC', id: 'DESC' },
        });
      },
    );

    it('does not query tasks when the project is missing', async () => {
      projectsService.findById.mockResolvedValue(null);
      await expect(service.findByProject(projectId)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('preserves project lookup errors without querying tasks', async () => {
      const error = new Error('Project lookup failed');
      projectsService.findById.mockRejectedValue(error);
      await expect(service.findByProject(projectId)).rejects.toBe(error);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('preserves task query errors', async () => {
      const error = new Error('Task lookup failed');
      projectsService.findById.mockResolvedValue({ id: projectId });
      repository.find.mockRejectedValue(error);
      await expect(service.findByProject(projectId)).rejects.toBe(error);
    });
  });
});
