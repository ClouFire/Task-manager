import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from './projects.entity';
import { Task } from '../tasks/task.entity';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    delete: jest.Mock;
    existsBy: jest.Mock;
  };
  let tasks: { existsBy: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOneBy: jest.fn(),
            delete: jest.fn(),
            existsBy: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: getRepositoryToken(Task),
          useValue: { existsBy: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    repository = module.get(getRepositoryToken(Project));
    tasks = module.get(getRepositoryToken(Task));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('delete', () => {
    const id = '875da7a2-8c67-4f67-8835-04773be3815f';

    it('returns 404 before checking tasks when the project is missing', async () => {
      repository.existsBy.mockResolvedValue(false);
      await expect(service.delete(id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(tasks.existsBy).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('rejects invalid UUIDs before accessing repositories', async () => {
      await expect(service.delete('invalid')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tasks.existsBy).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('rejects projects with tasks without deleting anything', async () => {
      tasks.existsBy.mockResolvedValue(true);
      await expect(service.delete(id)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tasks.existsBy).toHaveBeenCalledWith({ projectId: id });
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('deletes an empty project', async () => {
      tasks.existsBy.mockResolvedValue(false);
      const result = { affected: 1, raw: [] };
      repository.delete.mockResolvedValue(result);
      await expect(service.delete(id)).resolves.toBe(result);
      expect(repository.delete).toHaveBeenCalledWith({ id });
    });

    it('returns 404 when no project was deleted', async () => {
      tasks.existsBy.mockResolvedValue(false);
      repository.delete.mockResolvedValue({ affected: 0, raw: [] });
      await expect(service.delete(id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns a conflict if a task appears after the preliminary check', async () => {
      tasks.existsBy.mockResolvedValue(false);
      repository.delete.mockRejectedValue(
        new QueryFailedError(
          'DELETE',
          [],
          Object.assign(new Error('foreign key violation'), {
            code: '23503',
            constraint: 'FK_task_project',
          }),
        ),
      );
      await expect(service.delete(id)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it.each([
      new Error('connection lost'),
      new QueryFailedError(
        'DELETE',
        [],
        Object.assign(new Error('other constraint'), {
          code: '23503',
          constraint: 'FK_other',
        }),
      ),
      new QueryFailedError(
        'DELETE',
        [],
        Object.assign(new Error('other database error'), {
          code: '23505',
          constraint: 'FK_task_project',
        }),
      ),
    ])('does not disguise unexpected deletion errors: %s', async (error) => {
      tasks.existsBy.mockResolvedValue(false);
      repository.delete.mockRejectedValue(error);
      await expect(service.delete(id)).rejects.toBe(error);
    });
  });

  it.each([
    [{ name: 'Project' }, null],
    [{ name: 'Project', description: null }, null],
    [{ name: 'Project', description: '' }, null],
    [{ name: 'Project', description: 'Description' }, 'Description'],
  ])(
    'normalizes empty descriptions and preserves text: %j',
    async (dto, description) => {
      const expected = {
        name: dto.name,
        description,
      };
      const project = Object.assign(new Project(), expected);
      repository.create.mockReturnValue(project);
      repository.save.mockResolvedValue(project);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(expected);
      expect(repository.save).toHaveBeenCalledWith(project);
      expect(result.description).toBe(expected.description);
    },
  );
});
