
import { parseName, parsePath } from '../utils/parsers';
import { findOrCreateControllerData, setInjects } from '../utils/reflect';
import { ControllerData, ControllerDecorator, ControllerOptions, Middleware } from '../utils/types';

export function Controller(options: ControllerOptions = {}): ControllerDecorator {
	return (constructor) => {
		const controller = Object.assign(findOrCreateControllerData(constructor), options) as ControllerData;

		controller.useMethodNames ??= false;
		controller.path ??= parseName(constructor.name, 'Controller');
		controller.param ??= {};
		controller.authHandler ||= void 0;
		controller.middleware = (Array.isArray(controller.middleware) ? controller.middleware : [controller.middleware]).filter(Boolean) as Middleware[];
		controller.responseHandler ||= void 0;

		for (const e of controller.endpoints) {
			// set controller constructor
			e.controller = constructor;

			// set default path
			e.path ??= '';

			// set default param
			e.param = { ...controller.param, ...e.param || {} };

			// set default endpoint method
			e.method ??= 'GET';

			// set default endpoint bodyType
			e.bodyType ??= e.bodyRule === void 0 ? 'none' : 'json';

			// set default endpoint authHandler
			e.authHandler ??= controller.authHandler ?? null;

			// set endpoint middlewares
			e.middleware = e.middleware ? controller.middleware.concat(e.middleware).filter(Boolean)! : controller.middleware;

			// set default endpoint responseHandler
			e.responseHandler ||= controller.responseHandler;

			const controllerPath = controller.path;
			const endpointPath = controller.useMethodNames && !e.path ? parseName(e.name) : e.path;

			Object.assign(e, parsePath(`${controllerPath}/${endpointPath}`, e.param));
		}

		setInjects(constructor, controller);
	};
}
