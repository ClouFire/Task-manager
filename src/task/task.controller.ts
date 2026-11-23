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
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PatchTaskDto } from './dto/patch-task.dto';

@Controller('task')
export class TaskController {
    constructor(private readonly taskService: TaskService ) {}

    @Post(':projectId')
    create(@Body() createTaskDto: CreateTaskDto, @Param('projectId', new ParseUUIDPipe) projectId: string) {
        return this.taskService.create({...createTaskDto, projectId});
    }

    @UseInterceptors(ClassSerializerInterceptor)
    @Get(':id')
    async search(@Param('id', new ParseUUIDPipe) id: string) {
        const task = await this.taskService.findById(id);

        if (!task) {
            throw new NotFoundException(`Task with id: ${id} not found`);
        }

        return task;
    }

    @Patch(':id')
    async update(@Body() patchTaskDto: PatchTaskDto, @Param('id', new ParseUUIDPipe) id: string) {
        return this.taskService.update({ ...patchTaskDto, id });
    }

    @HttpCode(204)
    @Delete(':id')
    async delete(@Param('id', new ParseUUIDPipe) id: string) {
        return this.taskService.delete(id);
    }
}
