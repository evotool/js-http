import { HttpClient } from '@evojs/http-client';
import { readFileSync } from 'fs';
import { isDeepStrictEqual } from 'util';

import { Application, Controller, ControllerConstructor, Endpoint, File, HttpException, Inject, Injectable, MiddlewareType, Provider, RequestData } from '../src';
import { AsyncImportFn } from '../src/classes/Application';
import { createApplication, startApplication, stopApplication } from './files/test-utils';

jest.setTimeout(30000);

const http = new HttpClient({ debug() {} });

describe('endpoints', () => {
	const providers: (Provider | AsyncImportFn)[] = [];
	const controllers: (ControllerConstructor | AsyncImportFn)[] = [];
	const middlewares: MiddlewareType[] = [];
	let app: Application;

	it('should initialize EmptyController', () => {
		@Controller()
		class EmptyController {
			@Endpoint()
			empty(): null {
				return null;
			}
		}

		controllers.push(EmptyController);
	});

	it('should initialize FilledController', () => {
		@Controller({
			path: 'filled',
			useMethodNames: true,
			authHandler: () => null,
			responseHandler: (res, err, payload: any) => {
				interface Body {
					statusCode: number;
					message: string;
					error: any | null;
					payload: any | null;
				}

				const body: Body = {
					statusCode: 200,
					message: '',
					error: null,
					payload: null,
				};

				if (err) {
					if (err instanceof HttpException) {
						body.statusCode = err.statusCode;

						body.message = err.message || '';

						if (err.details instanceof Error) {
							const { message } = err.details;
							body.error = { message };
						} else {
							body.error = err.details ?? {};
						}
					} else {
						body.statusCode = 500;
						body.message = 'Internal Server Error';

						const { message, stack } = err;
						body.error = { message, stack };
					}
				} else {
					if (payload === null || payload === void 0) {
						return res.writeHead(204, { 'Content-Length': '0' }).end();
					}

					body.payload = payload;
				}

				const data = Buffer.from(JSON.stringify(body), 'utf-8');

				return res.writeHead(body.statusCode!, {
					'Content-Type': 'application/json; charset=utf-8',
					'Content-Length': `${data.byteLength}`,
				}).end(data);
			},
		})
		class FilledController {
			@Endpoint({
				method: 'GET',
				query: {
					q: { type: 'string', optional: true },
				},
				responseHandler: (res, err, body) => {
					res.setHeader('Content-Type', 'application/json; charset=utf-8');

					if (err) {
						return res.end(JSON.stringify({ error: err.message }));
					}

					res.end(JSON.stringify(body));
				},
			})
			async query({ query, cookies }: RequestData<any, { q?: string }>): Promise<{ q?: string; cookies: { q?: string } }> {
				await new Promise((r) => setTimeout(r, 10));

				return { ...query, cookies };
			}

			@Endpoint({
				path: 'params/:test(\\w+)',
				param: {},
				method: 'GET',
				middleware: [],
			})
			params({ body }: RequestData<any, {}, { file: File }>): { file: File } {
				return body;
			}

			@Endpoint({
				method: 'POST',
				middleware: [],
				bodyType: 'multipart',
				body: {
					file: {
						type: 'object' as const,
						unknown: true,
					},
					type: { type: 'string' as const, values: ['image' as const] },
					name: { type: 'string' as const },
					alt: { type: 'string' as const },
				},
				bodyOptions: {
					uploadsDirectory: 'tmp',
					filename(file): string {
						return file.filename;
					},
				},
			})
			multipart({ body }: RequestData<any, {}, { file: Partial<File>; type: 'image'; name: string; alt: string }>): { [key: string]: any } {
				return body;
			}

			@Endpoint({
				method: 'PUT',
				middleware: [],
				bodyType: 'json',
				body: {
					q: { type: 'string' },
				},
			})
			json({ body }: RequestData<any, {}, { q: string }>): { q: string } {
				return body;
			}

			@Endpoint({
				method: 'PUT',
				middleware: [],
				bodyType: 'urlencoded',
				body: {
					q: { type: 'string' },
				},
			})
			urlencoded({ body }: RequestData<any, {}, { q: string }>): { q: string } {
				return body;
			}
		}

		controllers.push(FilledController);
	});

	it('should initialize empty service', () => {
		@Injectable()
		class EmptyService {
			constructor(@Inject('EMPTY', { optional: true, default: {} }) readonly emptyObject: object) {}

			empty(): void {
			}
		}

		providers.push(EmptyService);
	});

	it('should initialize filled service', () => {
		@Injectable({
			deps: [HttpClient],
		})
		class FilledService {
			constructor(readonly http: HttpClient) {
			}

			async getText(): Promise<string> {
				return (await this.http.get<string>('https://gitlab.com/')).body();
			}
		}

		providers.push(FilledService);
	});

	it('should start server with controller', async (done) => {
		controllers.push(() => require('../test/files/controller'));
		providers.push(() => import('../test/files/service'));
		middlewares.push((req, res) => req.url?.startsWith('/test') ?? false);

		app = await createApplication({
			controllers,
			providers,
			middlewares,
			hooks: {
				controllersLoad(controllers) {
					expect(Array.isArray(controllers)).toBe(true);
				},
				endpointsLoad(endpoints) {
					expect(Array.isArray(endpoints)).toBe(true);
				},
				providersLoad(providers) {
					expect(Array.isArray(providers)).toBe(true);
				},
			},
		});

		await startApplication(app, 3000);
		done();
	});

	it('should check 404 response', async (done) => {
		const REPEAT_COUNT = 1000;
		const promises: Promise<any>[] = [];

		for (let i = 0; i < REPEAT_COUNT; i++) {
			promises.push((async (): Promise<void> => {
				const res = await http.get('http://localhost:3000/');
				const body = await res.body();

				expect(isDeepStrictEqual(body, {
					statusCode: 404,
					message: '',
					error: { message: 'Not found' },
					payload: null,
				})).toBe(true);
				expect(res.statusCode).toBe(404);
			})());
		}

		await Promise.all(promises);
		done();
	});

	it('should check 204 response', async (done) => {
		const REPEAT_COUNT = 1000;
		const promises: Promise<any>[] = [];

		for (let i = 0; i < REPEAT_COUNT; i++) {
			promises.push((async (): Promise<void> => {
				const res = await http.get('http://localhost:3000/empty');
				const body = await res.body();

				expect(isDeepStrictEqual(body, null)).toBe(true);
				expect(res.statusCode).toBe(204);
			})());
		}

		await Promise.all(promises);
		done();
	});

	it('should check QUERY and COOKIES 200 response', async (done) => {
		const REPEAT_COUNT = 10;
		const promises: Promise<any>[] = [];

		for (let i = 0; i < REPEAT_COUNT; i++) {
			promises.push((async (): Promise<void> => {
				const q = Math.random().toString(16)
					.substring(2);
				const qq = q.split('').reverse()
					.join('');
				const res = await http.get(`http://localhost:3000/filled/query?q=${q}`, { headers: { cookie: `q=${q}; qq=${q}; qq=${qq}` } });
				const body = await res.body();

				expect(isDeepStrictEqual(body, { q, cookies: { q, qq: [q, qq] } })).toBe(true);
				expect(res.statusCode).toBe(200);
			})());
		}

		await Promise.all(promises);
		done();
	});

	it('should check MULTIPART 200 response', async (done) => {
		const REPEAT_COUNT = 1;
		const promises: Promise<any>[] = [];

		for (let i = 0; i < REPEAT_COUNT; i++) {
			promises.push((async (): Promise<void> => {
				const res = await http.post<{ payload: { type: 'image'; name: string; alt: string; file: { name: string; type: string; size: number; encoding: string; path: string } } }>(`http://localhost:3000/filled/multipart`, {
					headers: {
						'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundaryJNqLtJvuSsf0N35T',
					},
					body: Buffer.concat([
						Buffer.from('------WebKitFormBoundaryJNqLtJvuSsf0N35T\r\n'
+ 'Content-Disposition: form-data; name="file"; filename="test"\r\n'
+ 'Content-Type: image/png\r\n'
+ '\r\n'),
						readFileSync('test/files/test.png'),
						Buffer.from('\r\n'
+ '------WebKitFormBoundaryJNqLtJvuSsf0N35T\r\n'
+ 'Content-Disposition: form-data; name="type"\r\n'
+ '\r\n'
+ 'image\r\n'
+ '------WebKitFormBoundaryJNqLtJvuSsf0N35T\r\n'
+ 'Content-Disposition: form-data; name="name"\r\n'
+ '\r\n'
+ '\r\n'
+ '------WebKitFormBoundaryJNqLtJvuSsf0N35T\r\n'
+ 'Content-Disposition: form-data; name="alt"\r\n'
+ '\r\n'
+ 'alt_\r\n'
+ '------WebKitFormBoundaryJNqLtJvuSsf0N35T--'),
					]),
				});
				const body = await res.body();

				expect(body).toBeTruthy();
				expect(body.payload.type).toBe('image');
				expect(body.payload.name).toBe('');
				expect(body.payload.alt).toBe('alt_');
				expect(body.payload.file.type).toBe('image/png');
				expect(body.payload.file.encoding).toBe('utf-8');
				expect(typeof body.payload.file.size).toBe('number');
				expect(body.payload.file.name).toBe('test');
				expect(body.payload.file.path.endsWith('test')).toBe(true);
				expect(res.statusCode).toBe(200);
			})());
		}

		await Promise.all(promises);
		done();
	});

	it('should check URLENCODED 200 response', async (done) => {
		const REPEAT_COUNT = 1;
		const promises: Promise<any>[] = [];

		for (let i = 0; i < REPEAT_COUNT; i++) {
			promises.push((async (): Promise<void> => {
				const q = Math.random().toString(16)
					.substring(2);
				const res = await http.put<{ payload: { q: string } }>(`http://localhost:3000/filled/urlencoded`, {
					headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
					body: `q=${q}`,
				});
				const body = await res.body();

				expect(body.payload.q).toBeTruthy();
				expect(typeof body.payload.q).toBe('string');
				expect(res.statusCode).toBe(200);
			})());
		}

		await Promise.all(promises);
		done();
	});

	it('should check JSON 200 response', async (done) => {
		const REPEAT_COUNT = 1;
		const promises: Promise<any>[] = [];

		for (let i = 0; i < REPEAT_COUNT; i++) {
			promises.push((async (): Promise<void> => {
				const q = Math.random().toString(16)
					.substring(2);
				const res = await http.put<{ payload: { q: string } }>(`http://localhost:3000/filled/json`, { body: { q } });
				const body = await res.body();

				expect(body.payload.q).toBeTruthy();
				expect(typeof body.payload.q).toBe('string');
				expect(res.statusCode).toBe(200);
			})());
		}

		await Promise.all(promises);
		done();
	});

	it('should close connection', async (done) => {
		await stopApplication(app);
		done();
	});

	it('should create http exceptions', (done) => {
		const ex404 = new HttpException(404, 'Not found');
		expect(ex404.statusCode).toBe(404);
		expect(ex404.message).toBe('Not found');
		expect(ex404.details).toBeUndefined();

		const err = new Error();
		let ex500 = new HttpException(500, 'Internal Server Error', err);
		expect(ex500.statusCode).toBe(500);
		expect(ex500.message).toBe('Internal Server Error');
		expect(ex500.details).toBe(err);

		ex500 = new HttpException();
		expect(ex500.statusCode).toBe(500);
		expect(ex500.message).toBe('');
		expect(ex500.details).toBeUndefined();
		done();
	});

	it('should throw controller duplicate exception', async (done) => {
		@Controller()
		class IndexController {}

		try {
			await createApplication({ controllers: [IndexController, IndexController] });
		} catch (err) {
			expect(err.message).toBe('Controller was provided more than one times');
			done();
		}
	});

	it('should throw controller duplicate exception', async (done) => {
		@Controller()
		class IndexController {
			@Endpoint({
				method: 'GET',
				path: 'endpoint',
			})
			endpoint(): void {}

			@Endpoint({
				method: 'GET',
				path: 'endpoint',
			})
			endpoint1(): void {}
		}

		try {
			await createApplication({ controllers: [IndexController] });
		} catch (err) {
			expect(err.message).toBeDefined();
			done();
		}
	});

	it('should throw server error', async (done) => {
		try {
			const app = await createApplication();
			await stopApplication(app);
		} catch (err) {
			expect(err.message).toBeDefined();
			done();
		}
	});

	it('should throw server error', async (done) => {
		try {
			const app = await createApplication();
			await stopApplication(app);
		} catch (err) {
			expect(err.message).toBeDefined();
			done();
		}
	});

	it('should throw error "Provider was provided more than one times"', async (done) => {
		try {
			@Injectable()
			class TestService {
			}

			await createApplication({
				providers: [TestService, TestService],
			});
		} catch (err) {
			expect(err.message).toBeDefined();
			done();
		}
	});

	it('should throw error ""Injectable" decorator do not provided to class"', async (done) => {
		try {
			class TestService {
			}

			await createApplication({
				providers: [TestService],
			});
		} catch (err) {
			expect(err.message).toBeDefined();
			done();
		}
	});

	it('should build providers', async (done) => {
		@Injectable()
		class TestService {
		}

		@Controller()
		class TestController {
			constructor(readonly test: TestService, @Inject('FACTORY') readonly factory: 1, @Inject('VALUE') readonly value: 2) {}

			@Endpoint()
			index(): {} {
				return {};
			}
		}

		@Controller()
		class SecondTestController {
			constructor(readonly test: any) {}

			@Endpoint()
			index(): {} {
				return {};
			}
		}

		const app = await createApplication({
			controllers: [TestController, SecondTestController],
			providers: [
				{ provide: TestService, useClass: TestService, deps: [{ provide: TestService, optional: true }, { provide: 'FACTORY' }, 'VALUE'] }, // should removed
				{ provide: TestService, useClass: TestService },
				{ provide: 'FACTORY', useFactory: () => null, deps: [{ provide: TestService, optional: true }, { provide: 'FACTORY' }, 'VALUE'] }, // should removed
				{ provide: 'FACTORY', useFactory: () => 1 },
				{ provide: 'VALUE', useValue: 2 },
			],
		});

		await startApplication(app, 3002);

		let res = await http.get<{ payload: {} }>('http://localhost:3002/test');
		const body = await res.body();
		expect(res.statusCode).toBe(200);
		expect(isDeepStrictEqual(body.payload, {})).toBe(true);

		res = await http.get('http://localhost:3002/second_test');
		expect(res.statusCode).toBe(500);

		res = await http.get('http://localhost:3002/any');
		expect(res.statusCode).toBe(404);
		await stopApplication(app);

		done();
	});

	it('should throw Circular dependency error', async (done) => {
		try {
			@Injectable()
			class ParentService {
				constructor(readonly parent: ParentService) {}
			}

			await createApplication({
				providers: [ParentService, { provide: 'VALUE', useValue: null }],
			});
		} catch (err) {
			expect(err.message).toBeDefined();
			done();
		}
	});

	it('should throw bad path error', async (done) => {
		try {
			@Controller()
			class IndexController {
				@Endpoint({
					path: 'test/:0',
				})
				test(): void {}
			}

			await createApplication({
				controllers: [IndexController],
			});
		} catch (err) {
			expect(err.message.startsWith('Bad path')).toBe(true);
			done();
		}
	});
});
