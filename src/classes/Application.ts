import { validate } from '@evojs/validator/validate';
import { IncomingMessage, Server, ServerOptions, ServerResponse, createServer } from 'http';
import * as qs from 'querystring';

import { BuiltInject, DepInjectOptions, ProviderConstructor, TokenType } from '..';
import type { ControllerConstructor, MiddlewareType } from '../decorators/Controller';
import type { BuiltEndpoint, HttpMethod, Params } from '../decorators/Endpoint';
import { ApplicationBodyOptions, Parsers, parseBody } from '../utils/parse-body';
import { parseCookie } from '../utils/parse-cookie';
import { CONTROLLER_ENDPOINTS_TOKEN, INJECTABLE_OPTIONS_TOKEN, REQUEST_TOKEN, RESPONSE_TOKEN } from '../utils/tokens';
import { HttpException } from './HttpException';

export class Application {
	protected static async _loadControllers(controllers: (ControllerConstructor | AsyncImportFn)[]): Promise<ControllerConstructor[]> {
		controllers = Array.from(controllers);

		for (let i = 0, a = controllers, l = a.length, x = a[i]; i < l; x = a[++i]) {
			if (!Reflect.hasMetadata(CONTROLLER_ENDPOINTS_TOKEN, x)) {
				const imports = await (x as AsyncImportFn)();
				const controllersFromImport = Object.values(imports)
					.filter((c) => typeof c === 'function' && Reflect.hasMetadata(CONTROLLER_ENDPOINTS_TOKEN, c)) as ControllerConstructor[];
				a.splice(i, 1, ...controllersFromImport);
				l = a.length;
			}
		}

		// Check duplicates
		for (let i = 0, a = controllers, l = a.length, x = a[i]; i < l; x = a[++i]) {
			if (a.indexOf(x) !== i) {
				throw new Error('Controller was provided more than one times');
			}
		}

		return controllers as ControllerConstructor[];
	}

	protected static async _loadProviders(providers: (Provider | AsyncImportFn)[]): Promise<BuiltProvider[]> {
		providers = Array.from(providers);

		// Load provider from imports
		for (let i = 0, a = providers, l = a.length, x = a[i]; i < l; x = a[++i]) {
			if (!Reflect.hasMetadata(INJECTABLE_OPTIONS_TOKEN, x) && typeof x !== 'object') {
				const imports = await (x as AsyncImportFn)();
				const providersFromImport = Object.values(imports)
					.filter((c) => typeof c === 'function' && Reflect.hasMetadata(INJECTABLE_OPTIONS_TOKEN, c) && !Reflect.hasMetadata(CONTROLLER_ENDPOINTS_TOKEN, c)) as Provider[];
				a.splice(i, 1, ...providersFromImport);
				l = a.length;
			}
		}

		// Check duplicates
		for (let i = 0, a = providers, l = a.length, x = a[i]; i < l; x = a[++i]) {
			if (a.indexOf(x) !== i) {
				throw new Error('Provider was provided more than one times');
			}
		}

		return this._buildProviders(providers as Provider[]);
	}

	protected static _buildProviders(providers: Provider[]): BuiltProvider[] {
		const builtProviders: BuiltProvider[] = [];

		for (const provider of providers as Provider[]) {
			if (typeof provider === 'function') {
				const deps = Reflect.getMetadata(INJECTABLE_OPTIONS_TOKEN, provider) as BuiltInject[];

				if (!deps) {
					throw new Error(`"Injectable" decorator do not provided to class "${provider.name}"`);
				}

				builtProviders.push({ provide: provider, useClass: provider, deps });
				Reflect.deleteMetadata(INJECTABLE_OPTIONS_TOKEN, provider);
			} else if ('useClass' in provider) {
				const deps = provider.deps?.map((dep) => typeof dep === 'object'
					? { ...dep, optional: dep.optional ?? false }
					: { provide: dep, optional: false }) || [];

				builtProviders.push({ ...provider, deps });
			} else if ('useFactory' in provider) {
				const deps = provider.deps?.map((dep) => typeof dep === 'object'
					? { ...dep, optional: dep.optional ?? false }
					: { provide: dep, optional: false }) || [];
				builtProviders.push({ ...provider, deps });
			} else {
				builtProviders.push({ ...provider });
			}
		}

		// remove duplicates
		for (let i = 0, a = builtProviders, p = a[i], l = a.length, checked = new Map<TokenType, number>(); i < l; p = a[++i]) {
			const index = checked.get(p.provide);
			checked.set(p.provide, i);

			if (typeof index === 'number') {
				builtProviders.splice(index, 1);
				i--;
				l = a.length;
			}
		}

		// check for circular dependency
		function checkCircularDependency(deps: BuiltInject[], parents: TokenType[] = []): void {
			for (const d of deps) {
				const p = builtProviders.find((x) => x.provide === d.provide)!;

				if (!p || !('deps' in p)) {
					continue;
				}

				if (parents.includes(p.provide)) {
					throw new Error(`Circular dependency: ${parents.map((p) => typeof p === 'function' ? p.name : `'${p}'`).join(' -> ')}`);
				}

				parents.push(p.provide);

				checkCircularDependency(p.deps, parents);
			}
		}

		for (const p of builtProviders) {
			if (!('deps' in p)) {
				continue;
			}

			checkCircularDependency(p.deps);
		}

		return builtProviders;
	}

	protected static _loadEndpoints(controllers: ControllerConstructor[]): BuiltEndpoint[] {
		const endpoints: BuiltEndpoint[] = controllers
			.filter((c) => typeof c === 'function' && Reflect.hasMetadata(CONTROLLER_ENDPOINTS_TOKEN, c))
			.map((c) => {
				const endpoints = Reflect.getMetadata(CONTROLLER_ENDPOINTS_TOKEN, c) as BuiltEndpoint[];
				Reflect.deleteMetadata(CONTROLLER_ENDPOINTS_TOKEN, c);

				return endpoints;
			})
			.flat();

		// Check endpoints for same location
		const methodPaths = endpoints.map((ep) => `${ep.method} ${ep.path}`);

		for (let i = 0, a = methodPaths, x = a[i], l = a.length; i < l; x = a[++i]) {
			if (a.indexOf(x) !== i) {
				throw new Error(`Some endpoints have the same location: "${x}"`);
			}
		}

		return endpoints;
	}

	protected static _collectBuiltInjects(controllers: ControllerConstructor[]): Map<ControllerConstructor, BuiltInject[]> {
		const injects = new Map<ControllerConstructor, BuiltInject[]>();

		for (const c of controllers) {
			const bi = Reflect.getMetadata(INJECTABLE_OPTIONS_TOKEN, c) as BuiltInject[];
			injects.set(c, bi);
			Reflect.deleteMetadata(INJECTABLE_OPTIONS_TOKEN, c);
		}

		return injects;
	}

	static async create(options: ApplicationOptions = {}): Promise<Application> {
		let {
			bodyOptions,
			controllers,
			hooks,
			middlewares,
			parsers,
			providers,
			responseHandler,
		} = options;
		const builtOptions = {} as BuiltApplicationOptions;

		hooks = hooks ? { ...hooks } : {};

		// Load controllers
		controllers = await this._loadControllers(controllers || []);

		if (hooks.controllersLoad) {
			await hooks.controllersLoad(controllers as ControllerConstructor[]);
		}

		// collect builtInjects
		builtOptions.builtInjects = this._collectBuiltInjects(controllers as ControllerConstructor[]);

		// Load providers
		builtOptions.providers = await this._loadProviders(providers || []);

		if (hooks.providersLoad) {
			await hooks.providersLoad(providers as BuiltProvider[]);
		}

		// Load endpoints
		builtOptions.endpoints = this._loadEndpoints(controllers as ControllerConstructor[]);

		if (hooks.endpointsLoad) {
			await hooks.endpointsLoad(builtOptions.endpoints);
		}

		// Reset parsers
		parsers = parsers ? { ...parsers } : {};

		if (!parsers.json) {
			parsers.json = JSON;
		}

		if (!parsers.urlencoded) {
			parsers.urlencoded = qs;
			parsers.urlencoded.queryMode = true;
		}

		builtOptions.parsers = parsers as Parsers;

		builtOptions.hooks = hooks;
		builtOptions.bodyOptions = bodyOptions ? { ...bodyOptions } : {};
		builtOptions.middlewares = middlewares || [];
		builtOptions.responseHandler = responseHandler;

		return new Application(builtOptions);
	}

	protected readonly _server: Server;
	protected readonly _hooks: ApplicationHooks;
	protected readonly _parsers: Parsers;
	protected readonly _bodyOptions: ApplicationBodyOptions;
	protected readonly _middlewares: MiddlewareType[];
	protected readonly _providers: BuiltProvider[];
	protected readonly _endpoints: BuiltEndpoint[];
	protected readonly _builtInjects = new Map<ControllerConstructor, BuiltInject[]>();

	readonly address: Readonly<{ host: string; port: number }> | null = null;

	protected constructor(options: BuiltApplicationOptions) {
		this._bodyOptions = options.bodyOptions;
		this._bodyOptions.json ??= {};
		this._bodyOptions.multipart ??= {};
		this._bodyOptions.none ??= {};
		this._bodyOptions.raw ??= {};
		this._bodyOptions.stream ??= {};
		this._bodyOptions.text ??= {};
		this._bodyOptions.urlencoded ??= {};
		this._providers = options.providers;
		this._builtInjects = options.builtInjects;
		this._endpoints = options.endpoints;
		this._hooks = options.hooks;
		this._middlewares = options.middlewares;
		this._parsers = options.parsers;

		if (options.responseHandler) {
			this._responseHandler = options.responseHandler;
		}

		this._server = createServer(this._requestHandler.bind(this));
	}

	listen(port: number): Promise<this>;
	listen(port: number, host: string): Promise<this>;
	async listen(port: number, host?: string): Promise<this> {
		return new Promise((resolve, reject) => {
			this._server.on('error', reject).listen(port, host, () => {
				Object.defineProperty(this, 'address', { value: { host: host || 'localhost', port }, writable: false });
				this._server.off('error', reject);
				resolve(this);
			});
		});
	}

	close(): Promise<this> {
		return new Promise((resolve, reject) => {
			this._server.close((err) => {
				if (err) {
					return reject(err);
				}

				Object.defineProperty(this, 'address', { value: null, writable: false });

				resolve(this);
			});
		});
	}

	protected _resolveArgs(providers: BuiltProvider[], target: TokenType, deps: BuiltInject[]): any[] {
		return deps.map((dep, i) => {
			const provider = providers.find((p) => p.provide === dep.provide);

			if (!provider) {
				if (dep.optional) {
					return dep.default;
				}

				throw new Error(`Provider of param #${i} not found for "${typeof target === 'function' ? target.name : target}"`);
			}

			if ('useClass' in provider) {
				const args = this._resolveArgs(providers, provider.useClass, provider.deps);

				return new provider.useClass(...args);
			}

			if ('useFactory' in provider) {
				const args = this._resolveArgs(providers, provider.provide, provider.deps);

				return provider.useFactory.call(null, ...args);
			}

			return provider.useValue;
		});
	}

	protected _buildControllerInstance(constructor: ControllerConstructor, dynamicProviders: BuiltValueProvider[] = []): { [key: string]: any } {
		const deps = this._builtInjects.get(constructor)!;
		const args = this._resolveArgs((dynamicProviders as BuiltProvider[]).concat(this._providers), constructor, deps);

		return new constructor(...args);
	}

	protected async _resolveMiddlewares(req: IncomingMessage, res: ServerResponse, middlewares: MiddlewareType[]): Promise<boolean> {
		for (const m of middlewares) {
			let response = m(req, res);

			if (response instanceof Promise) {
				response = await response;
			}

			if (response) {
				return true;
			}
		}

		return false;
	}

	protected _requestHandler(req: IncomingMessage, res: ServerResponse): void {
		Promise.resolve(this._responseHandler)
			.then(async (responseHandler) => {
				// Resolve global Middlewares
				if (await this._resolveMiddlewares(req, res, this._middlewares!)) {
					return;
				}

				// Parse location and querystring
				const [location, querystring] = (req.url || '').split('?', 2) as [string, string?];

				// Find endpoint and resolve params
				let params: Params = {};
				const endpoint = this._endpoints.find((ep) => {
					const match = ep.pathRegex.exec(location) as string[];

					if (match && (req.method === ep.method || (req.method === 'HEAD' && ep.method === 'GET'))) {
						params = Object.fromEntries(Array.from(match).slice(1).map((p, i) => [ep.paramOrder[i], decodeURIComponent(p)]));

						return true;
					}

					return false;
				});

				if (!endpoint) {
					throw new HttpException(404, void 0, new Error('Not found'));
				}

				// Resolve endpoint Middlewares
				if (await this._resolveMiddlewares(req, res, endpoint.middleware as MiddlewareType[])) {
					return;
				}

				// Set endpoint response handler if exists
				if (endpoint.responseHandler) {
					responseHandler = endpoint.responseHandler;
				}

				// Run auth handler
				const auth = endpoint.authHandler ? await endpoint.authHandler(req, res) : null;

				// Parse query
				const parsers = this._parsers;
				let query: { [key: string]: any };

				try {
					query = parsers.urlencoded!.parse(querystring || '');

					if (endpoint.queryRule) {
						query = validate(query, endpoint.queryRule, 'query', parsers.urlencoded!.queryMode);
					}
				} catch (err) {
					throw new HttpException(400, void 0, err);
				}

				// Parse body
				let body: any = await parseBody(req, endpoint.bodyType, parsers as Parsers, { ...this._bodyOptions[endpoint.bodyType], ...endpoint.bodyOptions });

				if (body !== void 0 && endpoint.bodyType !== 'stream') {
					try {
						const isQuery = endpoint.bodyType === 'multipart' || (endpoint.bodyType === 'urlencoded' && parsers.urlencoded!.queryMode);

						if (endpoint.bodyRule) {
							body = validate(body, endpoint.bodyRule, 'body', isQuery);
						}
					} catch (err) {
						throw new HttpException(400, void 0, err);
					}
				}

				// Parse cookie
				const cookies = parseCookie(req);

				// Build controller
				const controller = this._buildControllerInstance(endpoint.controller, [
					{ provide: REQUEST_TOKEN, useValue: req },
					{ provide: RESPONSE_TOKEN, useValue: res },
				]);

				// Getting response body
				let responseBody = endpoint.handler.call(controller, { method: req.method as HttpMethod, auth, body, query, params, headers: req.headers, cookies });

				if (responseBody instanceof Promise) {
					responseBody = await responseBody;
				}

				// Handle response
				await responseHandler(res, null, responseBody);
			})
			.catch((err) => this._responseHandler(res, err, void 0));
	}

	protected readonly _responseHandler: ResponseHandler = (res: ServerResponse, err: Error | null, payload: any) => {
		interface ResponseBody {
			statusCode: number;
			message: string;
			payload: { [key: string]: any } | null;
			error: { [key: string]: any } | null;
		}

		const body: ResponseBody = { error: null, payload: null } as ResponseBody;

		let statusMessage = body.message!;
		let exception: HttpException | undefined;

		if (err) {
			if (err instanceof HttpException) {
				exception = err;
			} else {
				exception = new HttpException(500, undefined, err);
			}

			body.statusCode = exception.statusCode;
			statusMessage = exception.message;

			if (exception.details instanceof Error) {
				const { message, stack } = exception.details;
				body.error = { message, stack: exception.statusCode >= 500 ? stack : void 0 };
			} else {
				body.error = exception.details ?? {};
			}
		} else {
			if (payload === null || payload === void 0) {
				return res.writeHead(204, { 'Content-Length': '0' }).end();
			}

			statusMessage = res.statusMessage || '';
			body.payload = payload;
			body.statusCode = res.statusCode || 200;
		}

		body.message = statusMessage;

		const data = Buffer.from(JSON.stringify(body), 'utf-8');

		return res.writeHead(body.statusCode!, '', {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Length': `${data.byteLength}`,
		}).end(data);
	};
}

export type ResponseHandler = (res: ServerResponse, err: Error | null, body: any) => void | PromiseLike<void>;

export interface ApplicationOptions extends ServerOptions {

	/**
	 * Body options for any body types
	 * @default {}
	 */
	bodyOptions?: ApplicationBodyOptions;

	/**
	 * Array of controller types or controller paths
	 * @default []
	 */
	controllers?: (ControllerConstructor | AsyncImportFn)[];

	/**
	 * @default {}
	 */
	hooks?: ApplicationHooks;

	/**
	 * @default []
	 */
	middlewares?: MiddlewareType[];

	/**
	 * @default Parsers
	 */
	parsers?: Partial<Parsers>;

	/**
	 * @default []
	 */
	providers?: (Provider | AsyncImportFn)[];
	responseHandler?: ResponseHandler;
}

export interface ValueProviderOptions {
	provide: TokenType;
	useValue: any;
}

export interface ClassProviderOptions {
	provide: TokenType;
	useClass: ProviderConstructor;
	deps?: (TokenType | DepInjectOptions)[];
}

export interface FactoryProviderOptions {
	provide: TokenType;
	useFactory(...args: any[]): any;
	deps?: (TokenType | DepInjectOptions)[];
}

export type ProviderOptions =
| ValueProviderOptions
| ClassProviderOptions
| FactoryProviderOptions;

export type Provider =
| ProviderConstructor
| ProviderOptions;

export type AsyncImportFn =  () => any | Promise<any>;

interface BuiltValueProvider {
	provide: TokenType;
	useValue: any;
}

interface BuiltClassProvider {
	provide: TokenType;
	useClass: ProviderConstructor;
	deps: BuiltInject[];
}

interface BuiltFactoryProvider {
	provide: TokenType;
	useFactory(...args: any[]): any;
	deps: BuiltInject[];
}

type BuiltProvider =
| BuiltValueProvider
| BuiltClassProvider
| BuiltFactoryProvider;

interface ApplicationHooks {
	controllersLoad?(controllers: ControllerConstructor[]): void | PromiseLike<void>;
	providersLoad?(providers: BuiltProvider[]): void | PromiseLike<void>;
	endpointsLoad?(endpoints: BuiltEndpoint[]): void | PromiseLike<void>;
}

interface BuiltApplicationOptions {
	bodyOptions: ApplicationBodyOptions;
	builtInjects: Map<ControllerConstructor, BuiltInject[]>;
	endpoints: BuiltEndpoint[];
	hooks: ApplicationHooks;
	middlewares: MiddlewareType[];
	parsers: Parsers;
	providers: BuiltProvider[];
	responseHandler?: ResponseHandler;
}
