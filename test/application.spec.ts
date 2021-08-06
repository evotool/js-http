import { HttpClient } from '@evojs/http-client';

import { Controller, Endpoint } from '../src';
import { createApplication, startApplication, stopApplication } from './utils';

const http = new HttpClient({ debug() {} });

describe('application', () => {
  it('should create application with default options', async () => {
    const app = await createApplication();
    expect(app.address).toBeNull();
  });

  it('should create application', async () => {
    const app = await createApplication({
      controllers: [],
      providers: [],
      middlewares: [],
      hooks: {},
      bodyOptions: {
      },
      parsers: {
        json: JSON,
        urlencoded: {
          parse() {},
          stringify() {
            return '';
          },
        },
      },
      responseHandler: (res, err, body) => {},
    });
    expect(app.address).toBeNull();
  });

  it('should start server', async () => {
    const app = await createApplication({ controllers: [] });
    await startApplication(app, 3001);
    await stopApplication(app);
  });

  it('should check middlewares', async () => {
    const app = await createApplication({
      controllers: [],
      middlewares: [
        (req, res) => false,
        async (req, res) => {
          await new Promise((r) => setTimeout(r, 10));
          res.writeHead(404, { 'content-type': 'text/plain' }).end('');

          return true;
        },
      ],
    });
    await startApplication(app, 3001);
    await http.get('http://localhost:3001/').then((res) => res.body());
    await stopApplication(app);
  });

  it('should check endpoint middlewares', async () => {
    @Controller()
    class IndexController {
      @Endpoint({
        middleware: [
          (req, res) => false,
          async (req, res) => {
            await new Promise((r) => setTimeout(r, 10));
            res.writeHead(404, { 'content-type': 'text/plain' }).end('');

            return true;
          },
        ],
      })
      test(): void {
      }
    }

    const app = await createApplication({ controllers: [IndexController] });
    await startApplication(app, 3001);
    await http.get('http://localhost:3001/index').then((res) => res.body());
    await stopApplication(app);
  });

  it('shoud return 400 exception due to bad query', async () => {
    @Controller()
    class IndexController {
      @Endpoint({
        query: {
          page: { type: 'number' },
        },
      })
      test(): void {
      }
    }

    const app = await createApplication({ controllers: [IndexController] });
    await startApplication(app, 3001);

    const body = await http.get<{ statusCode: number }>('http://localhost:3001/index', { query: { page: 'NaN' } }).then((res) => res.body());
    expect(body.statusCode).toBe(400);

    await stopApplication(app);
  });

  it('shoud return 400 exception due to bad body', async () => {
    @Controller()
    class IndexController {
      @Endpoint({
        method: 'POST',
        body: {
          page: { type: 'number' },
        },
      })
      test(): void {
      }
    }

    const app = await createApplication({ controllers: [IndexController] });
    await startApplication(app, 3001);

    const body = await http.post<{ statusCode: number }>('http://localhost:3001/index', { body: { page: 'NaN' } }).then((res) => res.body());
    expect(body.statusCode).toBe(400);

    await stopApplication(app);
  });
});
