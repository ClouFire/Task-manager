import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('task')
export class Task {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    
}