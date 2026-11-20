import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from './projects.entity';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
  };

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
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    repository = module.get(getRepositoryToken(Project));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
