import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  ClassSerializerInterceptor,
  UseInterceptors,
  NotFoundException,
  Patch,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PatchTaskDto } from './dto/patch-task.dto';
import { Task } from './task.entity';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @UseInterceptors(ClassSerializerInterceptor)
  @Get(':id')
  async search(@Param('id', new ParseUUIDPipe()) id: string) {
    const task = await this.tasksService.findById(id);

    if (!task) {
      throw new NotFoundException(`Task with id: ${id} not found`);
    }

    return task;
  }

  @Patch(':id')
  async update(
    @Body() patchTaskDto: PatchTaskDto,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Task> {
    return this.tasksService.update({ ...patchTaskDto, id });
  }

  @HttpCode(204)
  @Delete(':id')
  async delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tasksService.delete(id);
  }
}
