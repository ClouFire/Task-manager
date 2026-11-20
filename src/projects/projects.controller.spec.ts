import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { NotFoundException } from '@nestjs/common';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  const service = {
    create: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: service }],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('throws 404 when the project does not exist', async () => {
    service.findById.mockResolvedValue(null);

    await expect(
      controller.getProjectById('875da7a2-8c67-4f67-8835-04773be3815f'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
