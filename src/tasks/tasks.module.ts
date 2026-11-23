import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectTasksController } from './project-tasks.controller';

@Module({
  controllers: [TasksController, ProjectTasksController],
  providers: [TasksService],
  imports: [TypeOrmModule.forFeature([Task]), ProjectsModule],
  exports: [TasksService],
})
export class TasksModule {}
