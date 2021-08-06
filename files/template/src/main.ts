import './preload';

import { ContextStorage } from '@evojs/context';
import { Application, HttpException, InternalServerErrorException } from '@evojs/http';
import Logger from '@evojs/logger';
import type { ServerResponse } from 'http';

import { IndexController } from './controllers/IndexController';
import { HttpService } from './services/HttpService';
import { reqlogger } from './utils/helpers';
import { CorsMiddleware, ResponseTimeMiddleware, StaticMiddleware } from './utils/middlewares';

const logger = new Logger({ name: 'app' });
logger.warn(`application starting in ${process.env.ENV} mode`);

async function bootstrap(): Promise<void> {
  const { BACKEND_PORT = '3000', BACKEND_HOST = 'localhost' } = process.env;

  const app = await Application.create({
    middlewares: [ResponseTimeMiddleware, CorsMiddleware, StaticMiddleware],
    controllers: [IndexController],
    providers: [
      { provide: Logger, useFactory: () => reqlogger },
      HttpService,
    ],
    hooks: {
      endpointsLoad(endpoints) {
        logger.info(`Endpoints loaded:\n${endpoints.map((e) => `${e.path} ${e.method}`).join('\n')}`);
      },
    },
    responseHandler: (res: ServerResponse, err: Error | null, payload: any): void => {
      interface ResponseBody {
        statusCode: number;
        message: string;
        payload: Record<string, any> | null;
        error: Record<string, any> | null;
        traceId: string;
      }

      const body: ResponseBody = {
        statusCode: 500,
        message: '',
        payload: null,
        error: null,
        traceId: ContextStorage.getContext().traceId,
      };

      let ex: HttpException | undefined;

      if (err) {
        if (err instanceof HttpException) {
          ex = err;

          if (ex.statusCode === 400 && !ex.message) {
            ex.message = 'Bad Request';
          }
        } else {
          ex = new InternalServerErrorException(undefined, err);
        }

        body.statusCode = ex.statusCode;
        body.message = ex.message;

        if (ex.details instanceof Error) {
          const { message, stack } = ex.details;
          body.error = { message, stack };
        } else {
          body.error = ex.details ?? {};
        }
      } else {
        if (payload === null || payload === undefined) {
          return res.writeHead(204, { 'Content-Length': '0' }).end();
        }

        body.message = res.statusMessage || '';
        body.payload = payload;
        body.statusCode = res.statusCode || 200;
      }

      if (ex && ex.statusCode >= 500) {
        const err = ex.details;
        reqlogger.error(err);
      }

      const data = Buffer.from(JSON.stringify(body), 'utf-8');

      return res.writeHead(body.statusCode, '', {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': `${data.byteLength}`,
      }).end(data);
    },
  });

  await app.listen(+BACKEND_PORT, BACKEND_HOST);

  const { host, port } = app.address!;
  logger.info(`starting on http://${host}:${port}/`);
}

bootstrap().catch(logger.error);
