import { plainToInstance } from 'class-transformer';
import { isUUID, validate } from 'class-validator';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { Repository, QueryFailedError } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { PatchTaskDto } from './dto/patch-task.dto';
import { UpdateResult } from 'typeorm/browser';
import { TaskStatus } from './task-status.enum';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(dto: CreateTaskDto & { projectId: string }): Promise<Task> {
    const input = plainToInstance(CreateTaskDto, dto);
    const errors = await validate(input);
    
    if (errors.length || !isUUID(dto.projectId)) {
      throw new BadRequestException('Invalid task data');
    }

    const project = await this.projectsService.findById(dto.projectId);

    if (!project) {
      throw new NotFoundException('Project was not found');
    }

    const task = this.taskRepository.create({
      projectId: dto.projectId,
      title: input.title,
      description: input.description?.trim() ? input.description : null,
    });

    try {
      return await this.taskRepository.save(task);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const dbError = error.driverError as {
          code?: string;
          constraint?: string;
        };

        if (
          dbError.code === '23503' &&
          ['FK_task_project', 'FK_3797a20ef5553ae87af126bc2fe'].includes(
            dbError.constraint ?? '',
          )
        ) {
          throw new NotFoundException('Project was not found');
        }
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Task | null> {
    return this.taskRepository.findOneBy({ id });
  }

  async findByProject(projectId: string): Promise<Task[]> {
    const project = await this.projectsService.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project was not found');
    }

    return this.taskRepository.find({ 
        where: { projectId },
        order: {
            createdAt: 'DESC',
            id: 'DESC',
        }
    });
  }

  async update(dto: PatchTaskDto & { id: string }): Promise<{
    field: string;
    affected: number;
    oldValue: string | TaskStatus | null;
    newValue: string | TaskStatus | null;
  }[]> {
    const input = plainToInstance(PatchTaskDto, dto);
    const errors = await validate(input);
    
    if (errors.length || !isUUID(dto.id)) {
      throw new BadRequestException('Invalid task data');
    }

    const newTitle = input.title;
    const newDescription = input.description === undefined ? undefined : input.description?.trim() ? input.description : null;
    const newStatus = input.status;

    return this.taskRepository.manager.transaction(async (manager) => {
        const repository = manager.getRepository(Task);
        
        const task = await repository.findOne({
            where: { id: dto.id },
            lock: { mode: 'pessimistic_write' }
        });

        if (!task) {
            throw new NotFoundException('Task was not found');
        }
        
        const results = [];

        if (newTitle !== undefined && newTitle !== null && newTitle.trim()) {
            const update = await repository.update(dto.id, {
                title: newTitle,
            });

            if (update.affected !== 1) {
                throw new NotFoundException('Task was not found');
            }

            results.push({ field: 'title', affected: update.affected, oldValue: task.title, newValue: newTitle });
        }

        if (newDescription !== undefined) {
            const update = await repository.update(dto.id, {
                description: newDescription,
            });

            if (update.affected !== 1) {
                throw new NotFoundException('Task was not found');
            }

            results.push({ field: 'description', affected: update.affected, oldValue: task.description, newValue: newDescription });
        }
        
        if (newStatus !== undefined && newStatus !== null) {
            const update = await repository.update(dto.id, {
                status: newStatus,
            });

            if (update.affected !== 1) {
                throw new NotFoundException('Task was not found');
            }

            results.push({ field: 'status', affected: update.affected, oldValue: task.status, newValue: newStatus });
        }

        return results;
    });
  }

  async delete(id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid task data');
    }

    const result = await this.taskRepository.delete({ id });

    if (result.affected === 0) {
        throw new NotFoundException('Task was not found');
    }

    return result;
  }
}
