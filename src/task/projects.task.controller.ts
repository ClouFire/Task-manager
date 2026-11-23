import { Controller, ParseUUIDPipe, Get, Param } from '@nestjs/common';
import { TaskService } from './task.service';
import { Task } from './task.entity';

@Controller('projects/:projectId/tasks')
export class ProjectsTaskController {
    constructor(
        private readonly taskService: TaskService,
    ) {}

    @Get()
    findAll(@Param('projectId', new ParseUUIDPipe) projectId: string): Promise<Task[]> {
        return this.taskService.findByProject(projectId);
    }
}