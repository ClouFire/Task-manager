import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { isUUID, validate } from 'class-validator';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './projects.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PatchProjectDto } from './dto/patch-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  create(dto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepository.create({
      name: dto.name,
      description: dto.description === '' ? null : (dto.description ?? null),
    });

    return this.projectRepository.save(project);
  }

  findById(id: string): Promise<Project | null> {
    return this.projectRepository.findOneBy({ id });
  }

  findAll(): Promise<Project[]> {
    return this.projectRepository.find();
  }

  async update(dto: PatchProjectDto & { id: string }): Promise<Project> {
    const { id } = dto;
    const input = plainToInstance(PatchProjectDto, dto);
    const errors = await validate(input);

    if (!isUUID(id) || errors.length > 0) {
      throw new BadRequestException('Invalid project data');
    }

    const changes: PatchProjectDto = {};

    if (input.name !== undefined) {
      changes.name = input.name;
    }

    if (input.description !== undefined) {
      changes.description = input.description;
    }

    const hasChanges = Object.keys(changes).length > 0;

    return this.projectRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Project);
      
      const project = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!project) {
        throw new NotFoundException('Project was not found');
      }

      if (!hasChanges) {
        return project;
      }

      await repository.update(id, changes);
      return repository.findOneByOrFail({ id });
    });
  }
}
