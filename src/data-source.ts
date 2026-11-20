import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { loadEnvFile } from 'node:process';

loadEnvFile();

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

export default new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    
    entities: [
        join(__dirname, '**', '*.entity.{ts,js}'),
    ],

    migrations: [
        join(__dirname, 'migrations', '*.{ts,js}')
    ],

    synchronize: false,
})