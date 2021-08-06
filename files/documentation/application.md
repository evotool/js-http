# Application

## Usage example

`src/main.ts`:

```typescript
import { Application } from '@evojs/http';
import { IncomingMessage, ServerResponse } from 'http';
import { jsonc } from 'jsonc';
import * as mime from 'mime';
import * as bytes from 'bytes';
import * as path from 'path';

import { MediaController } from 'controllers/common/MediaController';
import { MediaService } from 'services/MediaService';

async function bootstrap(): Promise<void> {
  const { BACKEND_PORT, BACKEND_HOST } = process.env;

  const app = await Application.create({
    // controllers
    controllers: [
      // require or import controllers which have connected with Controller decorator
      () => import('controllers/store/index'),
      // provide a class which haves Controller decorator
      MediaController,
    ],
    // providers
    providers: [
      // useFactory provider
      {
        provide: 'LOGGER',
        useFactory() {
          const requestId = Math.random().toString(16).substring(2);
          const logger = (...args) => console.log(requestId, ...args);

          return logger;
        },
        scope: Scope.REQUEST,
        deps: [],
      },
      // useValue provider
      {
        provide: 'API_VERSION',
        useValue: process.env.API_VERSION,
      },
      // useClass provider
      {
        provide: HttpClient,
        useClass: MyHttpClient,
        scope: Scope.REQUEST,
        deps: ['LOGGER'],
      },
      // require or import services which have connected with Injectable decorator
      () => require('services/index'),
      // provide a class which haves Injectable decorator
      MediaService,
    ],
    // middlewares
    middlewares: [
      // example: CORS middleware
      (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Authorization, DNT, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Content-Type, Range',
        );
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

        if (req.method === 'OPTIONS') {
          res.writeHead(204, { 'Content-Length': '0' }).end();

          return 1;
        }

        return 0;
      },
    ],
    // custom parsers
    parsers: {
      // example: JSON with comments parser
      json: jsonc,
    },
    // custom bodyOptions
    bodyOptions: {
      json: {
        contentLengthLimit: bytes('1M'),
      },
      urlencoded: {
        contentLengthLimit: bytes('1M'),
      },
      text: {
        contentLengthLimit: bytes('1M'),
      },
      raw: {
        contentLengthLimit: bytes('1M'),
      },
      multipart: {
        uploadsDirectory: path.resolve(STATIC_PATH, 'uploads'),
        filename: (part) => `${randstr(64)}.${mime.getExtension(part.filetype)!}`,
        maxFileSize: bytes('1M'),
        maxFieldSize: 255,
        contentLengthLimit: bytes('2M'),
      },
    },
    // add application hooks
    hooks: {
      endpointsLoad: (endpoints) => {
        console.info(`Endpoints loaded:\n${endpoints.map((e) => `${e.path} ${e.method}`).join('\n')}`);
      },
    },
  });
  await app.listen(+BACKEND_PORT! || 3000, BACKEND_HOST ? '0.0.0.0' : 'localhost');

  const { host, port } = app.address!;
  console.info(`starting on http://${host}:${port}/`);
}

bootstrap().catch(console.error);
```

## Custom response handler

`src/main.ts`:

```typescript
const app = await Application.create({
  // <...>
  responseHandler: (res: ServerResponse, err: Error | null, payload: any): void => {
    const { statusCode } = res as ServerResponse;

    interface ResponseBody {
      statusCode: number;
      message: string;
      payload: { [key: string]: any } | null;
      error: { [key: string]: any } | null;
    }

    const body: ResponseBody = {
      error: null,
      payload: null,
    } as ResponseBody;

    let statusMessage = body.message!;

    let exception: HttpException | undefined;

    if (err) {
      if (err instanceof QueryFailedError) {
        const code = err.code;
        exception =
          code === '23503'
            ? new NotFoundException(undefined, err)
            : code === '23505'
            ? new ForbiddenException(undefined, err)
            : new InternalServerErrorException(undefined, err);
      } else if (err instanceof ServiceException) {
        exception = new BadRequestException(undefined, err);
      } else if (err instanceof HttpException) {
        exception = err;
      } else {
        exception = new InternalServerErrorException(undefined, err);
      }

      body.statusCode = exception.statusCode;
      statusMessage = exception.message;

      if (exception.details instanceof Error) {
        const { message, stack } = exception.details;
        body.error = { message, stack };
      } else {
        body.error = exception.details ?? {};
      }
    } else {
      if (payload === null || payload === undefined) {
        return res.writeHead(204, { 'Content-Length': '0' }).end();
      }

      statusMessage = res.statusMessage || '';
      body.payload = payload;
      body.statusCode = statusCode || 200;
    }

    if (exception && exception.statusCode >= 500) {
      const err = exception.details;
      console.error(err);
    }

    body.message = statusMessage;

    const data = Buffer.from(JSON.stringify(body), 'utf-8');

    return res
      .writeHead(body.statusCode!, '', {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': `${data.byteLength}`,
      })
      .end(data);
  },
  // <...>
});
```
