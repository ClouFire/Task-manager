import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  NotFoundException,
  ParseUUIDPipe,
  ClassSerializerInterceptor,
  UseInterceptors,
  Patch,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';
import { Project } from './projects.entity';
import { PatchProjectDto } from './dto/patch-project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async createProject(@Body() projectData: CreateProjectDto): Promise<Project> {
    return await this.projectsService.create(projectData);
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Get(':id')
  async getProjectById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Project> {
    const project = await this.projectsService.findById(id);

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  @Get()
  async getAllProjects() {
    return await this.projectsService.findAll();
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Patch(':id')
  async update(
    @Body() patchProjectDto: PatchProjectDto,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Project> {
    return await this.projectsService.update({ ...patchProjectDto, id });
  }

  @HttpCode(204)
  @Delete(':id')
  async delete(@Param('id', new ParseUUIDPipe) id: string) {
    return await this.projectsService.delete(id);
  }
}
