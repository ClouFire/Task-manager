import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
@Unique('UQ_users_email', ['email'])
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'varchar',
        nullable: false,
        length: 254
    })
    email: string;

    @Exclude()
    @Column({
        nullable: false,
        select: false
    })
    passwordHash: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}