
import type { Constructor, Middleware, ResponseHandler } from '../classes/Application';
import { parseName, parsePath } from '../utils/parsers';
import { findOrCreateControllerData, setInjects } from '../utils/reflect';
import type { AuthHandler, EndpointData, ParamSchema } from './Endpoint';
import type { InjectableData, InjectableOptions } from './Injectable';

export function Controller(options: ControllerOptions = {}): ControllerDecorator {
  return (constructor) => {
    const controller = Object.assign(findOrCreateControllerData(constructor), options) as ControllerData;

    controller.useMethodNames ??= false;
    controller.path ??= parseName(constructor.name, 'Controller');
    controller.param ??= {};
    controller.authHandler ||= undefined;
    controller.middleware = (Array.isArray(controller.middleware) ? controller.middleware : [controller.middleware]).filter(Boolean)!;
    controller.responseHandler ||= undefined;

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
      e.bodyType ??= e.bodyRule === undefined ? 'none' : 'json';

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

export interface ControllerOptions extends InjectableOptions {
  path?: string;
  param?: ParamSchema;
  useMethodNames?: boolean;
  authHandler?: AuthHandler;
  middleware?: Middleware | Middleware[];
  responseHandler?: ResponseHandler;
}

export interface ControllerData extends InjectableData {
  path: string;
  param: ParamSchema;
  useMethodNames: boolean;
  authHandler: AuthHandler | undefined;
  middleware: Middleware[];
  responseHandler: ResponseHandler | undefined;
  endpoints: EndpointData[];
}

export type ControllerDataMap = Map<Constructor, ControllerData>;

export type ControllerDecorator = (constructor: Constructor) => void;
