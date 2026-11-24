import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { isUUID, validate } from 'class-validator';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './projects.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PatchProjectDto } from './dto/patch-project.dto';
import { DeleteResult } from 'typeorm';
import { Task } from '../tasks/task.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,

    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
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

  async delete(id: string): Promise<DeleteResult> {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid project data');
    }

    const isProject = await this.projectRepository.existsBy({ id });

    if (!isProject) {
      throw new NotFoundException('Project was not found');
    }

    const hasTasks = await this.taskRepository.existsBy({ projectId: id });

    if (hasTasks) {
      throw new ConflictException(
        'Unable to delete project with existing tasks',
      );
    }

    try {
      const result = await this.projectRepository.delete({ id });

      if (result.affected === 0) {
        throw new NotFoundException('Project was not found');
      }

      return result;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError.code === '23503' &&
        error.driverError.constraint === 'FK_task_project'
      ) {
        throw new ConflictException(
          'Unable to delete project with existing tasks',
        );
      }
      throw error;
    }
  }
}
