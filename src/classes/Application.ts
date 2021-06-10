import { validate } from '@evojs/validator/validate';
import { IncomingMessage, Server, ServerResponse, createServer } from 'http';
import * as querystring from 'querystring';

import { parseBody } from '../utils/parsers';
import {
	findControllerData,
	findInjectableData,
	hasControllerData,
	hasInjectableData,
	removeControllerData,
	removeInjectableData,
} from '../utils/reflect';
import {
	Address,
	ApplicationBodyOptions,
	ApplicationData,
	ApplicationHooks,
	ApplicationOptions,
	ClassProviderData,
	Constructor,
	ControllerData,
	ControllerDataMap,
	EndpointData,
	FactoryProviderData,
	ImportOrRequireFn,
	InjectData,
	Middleware,
	Params,
	Parsers,
	Provider,
	ProviderData,
	ResponseHandler,
	Scope,
	ValueProviderData,
} from '../utils/types';
import {
	BadRequestException,
	HttpException,
	INTERNAL_HTTP_EXCEPTIONS,
	InternalServerErrorException,
	NotFoundException,
} from './HttpException';

export class Application {
	private _address: Readonly<{ host: string; port: number }> | null = null;
	private readonly _server: Server;
	private readonly _hooks: ApplicationHooks;
	private readonly _parsers: Parsers;
	private readonly _bodyOptions: ApplicationBodyOptions;
	private readonly _middlewares: Middleware[];
	private readonly _providers: ProviderData[];
	private readonly _endpoints: EndpointData[];
	private readonly _controllers: ControllerDataMap;
	private readonly _singletons: Map<any, any> = new Map<any, any>();

	get address(): Readonly<{ host: string; port: number }> | null {
		return this._address;
	}

	private constructor(data: ApplicationData) {
		this._bodyOptions = data.bodyOptions;
		this._bodyOptions.json ||= {};
		this._bodyOptions.multipart ||= {};
		this._bodyOptions.none ||= {};
		this._bodyOptions.raw ||= {};
		this._bodyOptions.text ||= {};
		this._bodyOptions.urlencoded ||= {};
		this._providers = data.providers;
		this._controllers = data.controllers;
		this._endpoints = data.endpoints;
		this._hooks = data.hooks;
		this._middlewares = data.middlewares;
		this._parsers = data.parsers;

		if (data.responseHandler) {
			this._responseHandler = data.responseHandler;
		}

		this._server = createServer(this._requestHandler.bind(this));
	}

	listen(port: number): Promise<this>;
	listen(port: number, host: string): Promise<this>;
	async listen(port: number, host: string = 'localhost'): Promise<this> {
		return new Promise((resolve, reject) => {
			this._server
				.on('error', reject)
				.listen(port, host, () => {
					this._address = { host, port } as Address;
					Object.defineProperty(this._address, 'host', { value: host, writable: false });
					Object.defineProperty(this._address, 'port', { value: port, writable: false });
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

				this._address = null;

				resolve(this);
			});
		});
	}

	private _resolveArgs(providers: ProviderData[], injects: InjectData[] = [], name: string): any[] {
		const args = injects.map((inject, index) => {
			const provider = providers.find((p) => p.provide === inject.token);

			if (!provider) {
				return;
			}

			if (this._singletons.has(provider.provide)) {
				return this._singletons.get(provider.provide);
			}

			let arg: any;

			if ('useClass' in provider) {
				const args = this._resolveArgs(providers, provider.injects, provider.useClass.name || provider.provide?.name);
				arg = new provider.useClass(...args);
			} else if ('useFactory' in provider) {
				const args = this._resolveArgs(providers, provider.injects, provider.provide);
				arg = provider.useFactory.call(null, ...args);
			} else {
				arg = provider.useValue;
			}

			if (provider.scope === Scope.DEFAULT) {
				this._singletons.set(provider.provide, arg);
			}

			return arg;
		});

		return args;
	}

	private _buildControllerInstance(constructor: Constructor, requestProviders: ValueProviderData[] = []): any {
		if (this._singletons.has(constructor)) {
			return this._singletons.get(constructor);
		}

		const controller = this._controllers.get(constructor)!;
		const args = this._resolveArgs((requestProviders as ProviderData[]).concat(this._providers), controller.injects, constructor.name);
		const instance = new constructor(...args);

		if (controller.scope === Scope.DEFAULT) {
			this._singletons.set(constructor, instance);
		}

		return instance;
	}

	private async _resolveMiddlewares(req: IncomingMessage, res: ServerResponse, middlewares: Middleware[]): Promise<boolean> {
		for (const middleware of middlewares) {
			let response = middleware(req, res);

			if (response instanceof Promise) {
				response = await response;
			}

			if (response) {
				if (this._hooks.middlewareExceptions) {
					const value = this._hooks.middlewareExceptions(middleware, response);

					if (value instanceof Promise) {
						value.catch((err) => {
							throw err;
						});
					}
				}

				return true;
			}
		}

		return false;
	}

	private _requestHandler(req: IncomingMessage, res: ServerResponse): void {
		Promise.resolve(this._responseHandler)
			.then(async (responseHandler) => {
				// Resolve global Middlewares
				if (await this._resolveMiddlewares(req, res, this._middlewares!)) {
					return;
				}

				// Parse location and queryString
				const [location, queryString] = (req.url || '').split('?', 2) as [string, string?];

				// Find endpoint and resolve params
				const params: Params = {};
				const endpoint = this._endpoints.find((ep) => {
					const match = ep.pathRegex.exec(location) as string[];

					if (match && (req.method === ep.method || (req.method === 'HEAD' && ep.method === 'GET'))) {
						const matchedParams = Array.from(match).slice(1);

						for (let i = 0, l = matchedParams.length; i < l; i++) {
							params[ep.paramOrder[i]] = decodeURIComponent(matchedParams[i]);
						}

						return true;
					}

					return false;
				});

				if (!endpoint) {
					throw new NotFoundException(INTERNAL_HTTP_EXCEPTIONS.ENDPOINT_NOT_FOUND);
				}

				// Resolve endpoint Middlewares
				if (await this._resolveMiddlewares(req, res, endpoint.middleware as Middleware[])) {
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
					query = parsers.urlencoded!.parse(queryString || '');

					if (endpoint.queryRule) {
						query = validate(query, endpoint.queryRule, 'query', parsers.urlencoded!.queryMode);
					}
				} catch (err) {
					throw new BadRequestException(void 0, err);
				}

				// Parse body
				let body: any = await parseBody(req, endpoint.bodyType, parsers as Parsers, { ...this._bodyOptions[endpoint.bodyType], ...endpoint.bodyOptions });

				if (body !== void 0) {
					try {
						const isQuery = endpoint.bodyType === 'multipart' || (endpoint.bodyType === 'urlencoded' && parsers.urlencoded!.queryMode);

						if (endpoint.bodyRule) {
							body = validate(body, endpoint.bodyRule, 'body', isQuery);
						}
					} catch (err) {
						throw new BadRequestException(void 0, err);
					}
				}

				// Build controller
				const controller = this._buildControllerInstance(endpoint.controller, [
					{ provide: IncomingMessage, useValue: req, scope: Scope.REQUEST },
					{ provide: ServerResponse, useValue: res, scope: Scope.REQUEST },
				]);

				// Getting response body
				let responseBody = endpoint.handler.call(controller, { auth, params, query, body, req, res });

				if (responseBody instanceof Promise) {
					responseBody = await responseBody;
				}

				// Handle response
				await responseHandler(res, null, responseBody);
			})
			.catch((err) => this._responseHandler(res, err, void 0));
	}

	private readonly _responseHandler: ResponseHandler = (res: ServerResponse, err: Error | null, payload: any) => {
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
				exception = new InternalServerErrorException(INTERNAL_HTTP_EXCEPTIONS.INTERNAL_SERVER_ERROR, err);
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

	private static async _loadControllers(controllers: (Constructor | ImportOrRequireFn)[], providers: ProviderData[]): Promise<ControllerDataMap> {
		controllers = Array.from(controllers);

		for (let i = 0, a = controllers, l = a.length, x = a[i]; i < l; x = a[++i]) {
			if (!hasControllerData(x as Constructor)) {
				const imports = await (x as ImportOrRequireFn)();
				const controllersFromImport = Object.values(imports)
					.filter((c) => typeof c === 'function' && hasControllerData(c as Constructor)) as Constructor[];
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

		const controllersMap = new Map<Constructor, ControllerData>();

		for (const c of controllers as Constructor[]) {
			const controller = findControllerData(c)!;
			controllersMap.set(c, controller);
			this._preloadInjectables(providers, controller, c.name);
			removeControllerData(c);
		}

		return controllersMap;
	}

	private static _preloadInjectables(providers: ProviderData[], injectable: { scope: Scope; injects?: InjectData[] }, name: string): void {
		if (!injectable.injects) {
			return;
		}

		for (let index = 0, a = injectable.injects, inject = a[index]; index < a.length; inject = a[++index]) {
			const provider = providers.find((p) => p.provide === inject.token);

			if (!provider) {
				if (inject.optional) {
					continue;
				}

				if (inject.token === IncomingMessage || inject.token === ServerResponse) {
					injectable.scope = Scope.REQUEST;

					continue;
				}

				throw new Error(`Provider of param #${index} not found for "${name}"`);
			}

			this._preloadInjectables(providers, provider, (provider as ClassProviderData).useClass?.name || provider.provide);

			if (provider.scope === Scope.REQUEST) {
				injectable.scope = Scope.REQUEST;
			}
		}
	}

	private static async _loadProviders(providers: (Provider | ImportOrRequireFn)[]): Promise<ProviderData[]> {
		providers = Array.from(providers);

		// Load provider from imports
		for (let i = 0, a = providers, l = a.length, x = a[i]; i < l; x = a[++i]) {
			if (typeof x === 'function') {
				if (hasInjectableData(x as Constructor)) {
					continue;
				}

				const imports = await (x as ImportOrRequireFn)();
				const providersFromImport = Object.values(imports)
					.filter((c) => typeof c === 'function' && hasInjectableData(c as Constructor)) as Provider[];
				a.splice(i, 1, ...providersFromImport);
				l = a.length;
			} else if (typeof x !== 'object') {
				throw new Error('Unknown provider');
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

	private static _buildProviders(providers: Provider[]): ProviderData[] {
		const builtProviders: ProviderData[] = [];

		for (const p of providers as Provider[]) {
			if (typeof p === 'function') {
				const injectable = findInjectableData(p)!;

				if (!injectable) {
					throw new Error(`"Injectable" decorator did not provide to class "${p.name}"`);
				}

				builtProviders.push({
					provide: p,
					useClass: p,
					injects: injectable.injects,
					scope: injectable.scope,
				});

				removeInjectableData(p);

				continue;
			}

			const pd: ProviderData = { scope: Scope.DEFAULT, ...p } as ProviderData;

			if ('deps' in p) {
				(pd as ClassProviderData | FactoryProviderData).injects = (p.deps!.map((token) => ({ token })) || []) as InjectData[];
			}

			builtProviders.push(pd);
		}

		// remove duplicates
		for (let i = 0, a = builtProviders, p = a[i], l = a.length, checked = new Map<any, number>(); i < l; p = a[++i]) {
			const index = checked.get(p.provide);
			checked.set(p.provide, i);

			if (typeof index === 'number') {
				builtProviders.splice(index, 1);
				i--;
				l = a.length;
			}
		}

		// check circular dependency
		function _checkCircularDependency(providers: Provider[], injects: InjectData[], parentTokens: any[] = []): void {
			for (const i of injects) {
				const p = providers.find((x) => x.provide === i.token);

				if (!p || !('injects' in p)) {
					continue;
				}

				if (parentTokens.includes(p.provide)) {
					throw new Error(`Circular dependency detected: ${parentTokens.map((p) => typeof p === 'function' ? p.name : `'${p}'`).join(' -> ')}`);
				}

				parentTokens.push(p.provide);

				_checkCircularDependency(providers, p.injects, parentTokens);
			}
		}

		for (const p of builtProviders) {
			if (!('injects' in p)) {
				continue;
			}

			_checkCircularDependency(providers, p.injects);
		}

		return builtProviders;
	}

	private static _loadEndpoints(controllerDataMap: ControllerDataMap): EndpointData[] {
		const endpoints: EndpointData[] = Array.from(controllerDataMap.values())
			.map((c) => c.endpoints)
			.reduce((p, n) => p.concat(n), []);

		// Check endpoints for same location
		const methodPaths = endpoints.map((ep) => `${ep.method} ${ep.path}`);

		for (let i = 0, a = methodPaths, x = a[i], l = a.length; i < l; x = a[++i]) {
			if (a.indexOf(x) !== i) {
				throw new Error(`Some endpoints have the same location: "${x}"`);
			}
		}

		return endpoints;
	}

	static async create(options: ApplicationOptions = {}): Promise<Application> {
		let { bodyOptions = {}, controllers = [], hooks = {}, middlewares = [], parsers = {}, providers = [], responseHandler } = options;

		const data = {} as ApplicationData;

		hooks = { ...hooks };

		// Load providers
		data.providers = await this._loadProviders(providers);

		await hooks.providersLoad?.(data.providers);

		// Load controllers
		data.controllers = await this._loadControllers(controllers, data.providers);

		await hooks.controllersLoad?.(data.controllers);

		// Load endpoints
		data.endpoints = this._loadEndpoints(data.controllers);

		await hooks.endpointsLoad?.(data.endpoints);

		// Reset parsers
		parsers = { ...parsers };

		parsers.json ||= JSON;

		if (!parsers.urlencoded) {
			parsers.urlencoded = querystring;
			parsers.urlencoded.queryMode = true;
		}

		data.parsers = parsers as Parsers;

		data.hooks = hooks;
		data.bodyOptions = { ...bodyOptions };
		data.middlewares = middlewares;
		data.responseHandler = responseHandler;

		return new Application(data);
	}
}
