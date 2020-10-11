import type { IncomingMessage, ServerResponse } from 'http';

import type { ResponseHandler } from '../classes/Application';
import { parseName } from '../utils/change-case';
import { getEndpoints } from '../utils/get-endpoints';
import { parsePath } from '../utils/parse-path';
import type { AuthHandler } from './Endpoint';
import { BuiltInjectable, Injectable, InjectableOptions } from './Injectable';

export function Controller(options: ControllerOptions = {}): ControllerDecorator {
	return (constructor) => {
		options = { ...options };

		options.useMethodNames = options.useMethodNames ?? false;
		options.path = options.path ?? parseName(constructor.name, 'Controller');
		options.authHandler = options.authHandler || void 0;
		options.middleware = [options.middleware].flat().filter(Boolean) as MiddlewareType[];
		options.responseHandler = options.responseHandler || void 0;

		const endpoints = getEndpoints(constructor);

		for (const endpoint of endpoints) {
			// set controller constructor
			endpoint.controller = constructor;

			// set default endpoint method
			if (!endpoint.method) {
				endpoint.method = 'GET';
			}

			// set default endpoint bodyType
			if (!endpoint.bodyType) {
				if (endpoint.bodyRule === void 0) {
					endpoint.bodyType = 'none';
				} else {
					endpoint.bodyType = 'json';
				}
			}

			// set default endpoint authHandler
			if (endpoint.authHandler === void 0) {
				endpoint.authHandler = options.authHandler ?? null;
			}

			// set endpoint middlewares
			endpoint.middleware = endpoint.middleware ? [options.middleware, endpoint.middleware].flat().filter(Boolean)! : options.middleware;

			// set default endpoint responseHandler
			if (typeof endpoint.responseHandler !== 'function' && typeof options.responseHandler === 'function') {
				endpoint.responseHandler = options.responseHandler;
			}

			const controllerName = parsePath(options.path);
			const actionName = options.useMethodNames && !endpoint.path ? parseName(endpoint.name) : parsePath(endpoint.path || '');
			const location = `/${[controllerName, actionName].filter(Boolean).join('/')}`;

			endpoint.location = new RegExp(`^${location}$`, 'i');
			endpoint.locationTemplate = location;
		}

		Injectable(options)(constructor);
	};
}

export interface ControllerOptions extends InjectableOptions {
	path?: string | (string | RegExp)[];
	useMethodNames?: boolean;
	authHandler?: AuthHandler;
	middleware?: MiddlewareType | MiddlewareType[];
	responseHandler?: ResponseHandler;
}

export interface BuiltControllerOptions extends BuiltInjectable {
	path: string;
	useMethodNames: boolean;
	authHandler: AuthHandler | undefined;
	middleware: MiddlewareType[];
	responseHandler: ResponseHandler | undefined;
}

export type MiddlewareType = (req: IncomingMessage, res: ServerResponse) => boolean | PromiseLike<boolean>;
export type ControllerType = new (...args: any[]) => { [key: string]: any };

type ControllerDecorator = (constructor: ControllerType) => void;
