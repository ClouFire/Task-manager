import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { ProjectsModule } from '../src/projects/projects.module';

export const TEST_MASTER_API_KEY = 'test-master-key-with-at-least-32-characters';

export function api(app: INestApplication) {
  return request
    .agent(app.getHttpServer())
    .set('Authorization', `Bearer ${TEST_MASTER_API_KEY}`);
}

export async function createDatabaseTestApp(
  settings: { currency?: string; taxTreatment?: string } = {},
) {
  const url = process.env.TEST_DATABASE_URL;
  
  if (!url) {
    throw new Error(
      'Set TEST_DATABASE_URL to a dedicated PostgreSQL test database',
    );
  }
  
  const schema = `erp_test_${randomUUID().replaceAll('-', '')}`;
  const admin = await new DataSource({ type: 'postgres', url }).initialize();
  
  await admin.query(`CREATE SCHEMA "${schema}"`);
  
  let app: INestApplication | undefined;
  
  const cleanup = async () => {
    try {
      if (app) {
        await app.close();
      }
    } finally {
      try {
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await admin.destroy();
      }
    }
  };
  
  try {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          skipProcessEnv: true,
          load: [
            () => ({
              MASTER_API_KEY: TEST_MASTER_API_KEY,
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url,
          schema,
          autoLoadEntities: true,
          synchronize: true,
        }),
        ProjectsModule
      ],
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    
    await app.init();
    
    return { app, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
