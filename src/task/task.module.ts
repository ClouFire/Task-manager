import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectsTaskController } from './projects.task.controller';

@Module({
  controllers: [TaskController, ProjectsTaskController],
  providers: [TaskService],
  imports: [
    TypeOrmModule.forFeature([Task]),
    ProjectsModule
  ],
  exports: [TaskService]
})
export class TaskModule {}
