/* eslint-disable @typescript-eslint/no-use-before-define */

import { ContextStorage } from '@evojs/context';
import type { Request as HttpRequest } from '@evojs/http';
import type { Caller, Level, Record } from '@evojs/logger';
import Logger from '@evojs/logger';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import cluster = require('cluster');
import { config } from 'dotenv';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { resolve as pathResolve } from 'path';
import { inspect } from 'util';

initLogger();
initEnv();
defineGlobals();

import type { User } from './database/entity/User';

export {};

declare global {
  function isArray(x: unknown): x is unknown[];
  function isObject(x: unknown): x is object;
  function isBoolean(x: unknown): x is boolean;
  function isNumber(x: unknown): x is number;
  function isString(x: unknown): x is string;
  function isFunction<T extends Function>(x: unknown): x is T;

  type RequestNoAuth<B = any, Q = {}> = HttpRequest<undefined, Q, B>;
  type RequestOptAuth<B = any, Q = {}> = HttpRequest<User | undefined, Q, B>;
  type Request<B = any, Q = {}> = HttpRequest<User, Q, B>;

  type ObjectId = string;
}

function initLogger(): void {
  ContextStorage.init();

  const LOGS_PATH = pathResolve('logs/');
  const ERROR_LOG_FILE = pathResolve(LOGS_PATH, 'error.log');

  if (!existsSync(LOGS_PATH)) {
    mkdirSync(LOGS_PATH, { recursive: true });
  }

  const errorLogFileStream = createWriteStream(ERROR_LOG_FILE, { flags: 'a' });
  const errorLevels: Level[] = ['warn', 'error', 'critical'];

  const wid = cluster.isMaster ? '0' : cluster.worker!.id;
  const pid = process.pid;

  Logger.configure({
    debug: true,
    meta: { wid, pid },
    formats: [`{{ date | isodate }} [${wid}:${pid}] {{ level | uppercase }}{{ name | name }} {{ args | message }}<-|->{{ caller | file }} `],
    pipes: {
      isodate: (v: number): string => new Date(v).toISOString(),
      uppercase: (text: string): string => text.toUpperCase(),
      name: (v: string | undefined): string => v ? ` <${v}${ContextStorage.hasContext() ? `:${ContextStorage.getContext().traceId.substring(0, 8)}` : ''}>` : '',
      message: (a: any[]): string => a.map((x) => typeof x === 'string' ? x : x instanceof Error ? x.stack : inspect(x, false, null, false)).join(' '),
      file: ({ fileName, line, column }: Caller): string => `${fileName}:${line}:${column}`,
    },
    handler(record: Record): void {
      const [message] = record.messages();

      if (errorLevels.includes(record.level)) {
        process.stderr.write(`${message}\n`);
        errorLogFileStream.write(`${message}\n`);
      } else {
        process.stdout.write(`${message}\n`);
      }
    },
  });

  Logger.overrideConsole();
}

function initEnv(): void {
  const ENV_TYPES = ['production', 'staging', 'testing', 'development'] as const;
  type NodeEnv = typeof ENV_TYPES[number];

  let nodeEnv = process.env.ENV as NodeEnv | undefined;

  if (!nodeEnv) {
    nodeEnv = 'development';
    process.env.ENV = nodeEnv;
  } else if (!ENV_TYPES.includes(nodeEnv)) {
    console.error(`Unknown environment type "${nodeEnv}"`);
    process.exit(1);
  }

  const envFile = `.env/${nodeEnv}.env`;

  if (existsSync(envFile)) {
    config({ path: envFile });
  }
}

function defineGlobals(): void {
  global.isArray = Array.isArray;
  global.isNumber = Number.isFinite as (x: unknown) => x is number;
  global.isObject = (x: unknown): x is object => typeof x === 'object' && x !== null;
  global.isBoolean = (x: unknown): x is boolean => typeof x === 'boolean';
  global.isString = (x: unknown): x is string => typeof x === 'string';
  global.isFunction = <T extends Function>(x: unknown): x is T => typeof x === 'function';
}
