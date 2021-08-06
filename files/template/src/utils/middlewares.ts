/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { createReadStream } from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import { getType } from 'mime';

import { getRemoteAddress, reqlogger } from './helpers';

export function ResponseTimeMiddleware(req: IncomingMessage, res: ServerResponse) {
  const startTime = process.hrtime.bigint();

  res.on('close', () => {
    const endTime = process.hrtime.bigint();
    const time = Number(endTime - startTime) / 1e6;
    reqlogger.info(req.method, res.statusCode, req.url, `${time.toFixed(2)}ms`, getRemoteAddress(req), req.headers['user-agent']);
  });
}

export function CorsMiddleware(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, DNT, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Content-Type, Range');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

  if (req.method === 'OPTIONS') {
    res
      .writeHead(204, {
        'Content-Length': '0',
      })
      .end();

    return 1;
  }

  return 0;
}

export function StaticMiddleware(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (req.url?.startsWith('/static')) {
      res.setHeader('content-type', `${getType(req.url) ?? 'text/plain'}; charset=utf-8`);

      const readStream = createReadStream(`.${req.url}`);

      readStream
        .on('error', (err) => {
          reqlogger.error(err);
          res.writeHead(500).end(
            JSON.stringify({
              statusCode: 500,
              message: 'Internal Server Error',
              error: { ...err },
              payload: null,
            }),
          );
          resolve(true);
        })
        .pipe(res);

      res.on('close', () => {
        readStream.destroy();
        resolve(true);
      });

      return;
    }

    resolve(false);
  });
}
