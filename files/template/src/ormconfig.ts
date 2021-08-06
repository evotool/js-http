import './preload';
import 'reflect-metadata';

import type { ConnectionOptions, QueryRunner } from 'typeorm';

import { DatabaseNamingStrategy } from './database/naming-strategy';
import { assertEnv, dbLogger } from './utils/helpers';

assertEnv(process.env, 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'REDIS_HOST', 'REDIS_PORT');

const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, REDIS_HOST, REDIS_PORT } = process.env;

const sourcePath = __dirname.endsWith('dist') ? 'dist' : 'src';

export = {
  name: 'default',
  type: 'postgres',
  host: POSTGRES_HOST,
  port: +POSTGRES_PORT || 5432,
  database: POSTGRES_DB,
  username: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
  synchronize: false,
  logger: {
    logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner): any {
      dbLogger.debug(query, parameters);
    },
    logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner): any {
      dbLogger.debug((error as Error).message || error, query, parameters);
    },
    logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner): any {
      dbLogger.warn(time, query, parameters);
    },
    logSchemaBuild(message: string, queryRunner?: QueryRunner): any {
      dbLogger.debug(message);
    },
    logMigration(message: string, queryRunner?: QueryRunner): any {
      dbLogger.debug(message);
    },
    log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner): any {
      dbLogger.debug(message);
    },
  },
  migrationsTableName: '_migrations',
  namingStrategy: new DatabaseNamingStrategy(),
  entities: [`${sourcePath}/database/entity/*`],
  migrations: [`${sourcePath}/database/migration/*`],
  subscribers: [`${sourcePath}/database/subscriber/*`],
  cli: {
    entitiesDir: 'src/database/entity',
    migrationsDir: 'src/database/migration',
    subscribersDir: 'src/database/subscriber',
  },
  cache: {
    type: 'redis',
    options: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
  },
} as ConnectionOptions;
