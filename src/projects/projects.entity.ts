import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('projects')
export class Project {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        length: 100,
        nullable: false,
    })
    name: string;

    @Column({
        type: 'varchar',
        length: 500,
        nullable: true,
    })
    description: string | null;

    @Exclude({ toPlainOnly: true })
    @CreateDateColumn({ type: 'timestamptz'})
    createdAt: Date;

    @Exclude({ toPlainOnly: true })
    @UpdateDateColumn({ type: 'timestamptz'})
    updatedAt: Date;
}