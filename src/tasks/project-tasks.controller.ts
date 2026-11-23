import {
  Controller,
  ParseUUIDPipe,
  Get,
  Param,
  Post,
  Body,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Task } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';

@Controller('projects/:projectId/tasks')
export class ProjectTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<Task[]> {
    return this.tasksService.findByProject(projectId);
  }

  @Post()
  create(
    @Body() createTaskDto: CreateTaskDto,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.tasksService.create({ ...createTaskDto, projectId });
  }
}
