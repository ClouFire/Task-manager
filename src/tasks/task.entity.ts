import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskStatus } from './task-status.enum';
import { Project } from '../projects/projects.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  projectId: string;

  @ManyToOne(() => Project, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'projectId',
    foreignKeyConstraintName: 'FK_task_project',
  })
  project: Project;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: false,
  })
  title: string;

  @Column({
    type: 'varchar',
    length: 2000,
    nullable: true,
  })
  description: string | null;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
