import type { IncomingMessage, ServerResponse } from 'http';

import type { ResponseHandler } from '../classes/Application';
import { parseName } from '../utils/change-case';
import { getEndpoints } from '../utils/get-endpoints';
import { parsePath } from '../utils/parse-path';
import type { AuthHandler, ParamSchema } from './Endpoint';
import { BuiltInjectable, Injectable, InjectableOptions } from './Injectable';

export function Controller(options: ControllerOptions = {}): ControllerDecorator {
	return (constructor) => {
		options = { ...options };

		options.useMethodNames ??= false;
		options.path ??= parseName(constructor.name, 'Controller');
		options.param ??= {};
		options.authHandler ||= void 0;
		options.middleware = [options.middleware].flat().filter(Boolean) as MiddlewareType[];
		options.responseHandler ||= void 0;

		const endpoints = getEndpoints(constructor);

		for (const endpoint of endpoints) {
			// set controller constructor
			endpoint.controller = constructor;

			// set default path
			endpoint.path ??= '';

			// set default param
			endpoint.param = { ...options.param, ...endpoint.param || {} };

			// set default endpoint method
			endpoint.method ??= 'GET';

			// set default endpoint bodyType
			endpoint.bodyType ??= endpoint.bodyRule === void 0 ? 'none' : 'json';

			// set default endpoint authHandler
			endpoint.authHandler ??= options.authHandler ?? null;

			// set endpoint middlewares
			endpoint.middleware = endpoint.middleware ? [options.middleware, endpoint.middleware].flat().filter(Boolean)! : options.middleware;

			// set default endpoint responseHandler
			endpoint.responseHandler ||= options.responseHandler;

			const controllerPath = options.path;
			const endpointPath = options.useMethodNames && !endpoint.path ? parseName(endpoint.name) : endpoint.path;

			Object.assign(endpoint, parsePath(`${controllerPath}/${endpointPath}`, endpoint.param));
		}

		Injectable(options)(constructor);
	};
}

export interface ControllerOptions extends InjectableOptions {
	path?: string;
	param?: ParamSchema;
	useMethodNames?: boolean;
	authHandler?: AuthHandler;
	middleware?: MiddlewareType | MiddlewareType[];
	responseHandler?: ResponseHandler;
}

export interface BuiltControllerOptions extends BuiltInjectable {
	path: string;
	param: ParamSchema;
	useMethodNames: boolean;
	authHandler: AuthHandler | undefined;
	middleware: MiddlewareType[];
	responseHandler: ResponseHandler | undefined;
}

export type MiddlewareType = (req: IncomingMessage, res: ServerResponse) => boolean | PromiseLike<boolean>;
export type ControllerType = new (...args: any[]) => { [key: string]: any };

type ControllerDecorator = (constructor: ControllerType) => void;
