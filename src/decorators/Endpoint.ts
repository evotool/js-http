import { ObjectRule, PrimitiveRule, RuleType, SchemaType, ValidationRule, ValidationSchema } from '@evojs/validator';
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'http';

import { ResponseHandler } from '../classes/Application';
import { getEndpoints } from '../utils/get-endpoints';
import { BodyType } from '../utils/parse-body';
import { Cookies } from '../utils/parse-cookie';
import { ControllerType, MiddlewareType } from './Controller';

export function Endpoint<O extends EndpointOptions>(options: O = {} as O): EndpointDecorator<O> {
	return (controller, propertyKey, descriptor) => {
		const buildOptions = { ...options, name: propertyKey } as unknown as BuiltEndpoint;

		// set handler
		buildOptions.handler = descriptor.value!;

		// set descriptor
		buildOptions.descriptor = descriptor;

		// set bodyRule if body exists
		if (buildOptions.body) {
			buildOptions.bodyRule = { type: 'object', schema: buildOptions.body, parse: buildOptions.bodyParser };
		}

		// set queryRule if query exists
		if (buildOptions.query) {
			buildOptions.queryRule = { type: 'object', schema: buildOptions.query };
		}

		// set endpoint
		const endpoints = getEndpoints(controller.constructor as ControllerType);
		endpoints.push(buildOptions);
	};
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
export type EndpointHandler = (request: RequestData) => any | PromiseLike<any>;

export interface EndpointOptions {
	path?: string | (string | RegExp)[];
	method?: HttpMethod;
	query?: ValidationSchema;
	body?: ValidationSchema;
	bodyRule?: ValidationRule;
	bodyType?: BodyType;
	bodyParser?(x: any, rule: ObjectRule): any;
	authHandler?: AuthHandler | null;
	middleware?: MiddlewareType | MiddlewareType[];
	responseHandler?: ResponseHandler;
}

export interface BuiltEndpoint extends EndpointOptions {
	name: string;
	method: HttpMethod;
	controller: ControllerType;
	handler: EndpointHandler;
	location: RegExp;
	locationTemplate: string;
	descriptor: PropertyDescriptor;
	bodyType: BodyType;
	queryRule?: ObjectRule;
}

export interface RequestData<Auth = any, Query = any, Body = any> {
	method: HttpMethod;
	auth: Auth;
	query: Query;
	body: Body;
	params: string[];
	cookies: Cookies;
	headers: IncomingHttpHeaders;
}

export type AuthHandler = (req: IncomingMessage, res: ServerResponse) => any | PromiseLike<any>;

interface StaticBodyTypes {
	none: undefined;
	stream: IncomingMessage;
	text: string;
	raw: Buffer;
}

type PromiseType<T> = T extends PromiseLike<any> ? Parameters<NonNullable<Parameters<T['then']>[0]>>[0] : T;

type AuthValue<AH extends EndpointOptions['authHandler']> = AH extends (...args: any[]) => any ? PromiseType<ReturnType<AH>> : any;
type QueryValue<Q extends EndpointOptions['query']> = Q extends ValidationSchema ? SchemaType<Q> : { [key: string]: string | string[] };
type BodyValue<BT extends EndpointOptions['bodyType'], B extends EndpointOptions['body'], BP extends EndpointOptions['bodyParser'], BR extends EndpointOptions['bodyRule']> =
BT extends keyof StaticBodyTypes ? StaticBodyTypes[BT] :
	B extends ValidationSchema ? (BP extends (...args: any[]) => any ? ReturnType<BP> : SchemaType<B>) :
		BR extends PrimitiveRule[] ? RuleType<BR[number]> :
			BR extends PrimitiveRule ? RuleType<BR> : any;

type OptionsRequestData<O extends EndpointOptions> = RequestData<AuthValue<O['authHandler']>, QueryValue<O['query']>, BodyValue<O['bodyType'], O['body'], O['bodyParser'], O['bodyRule']>>;
type EndpointDecorator<O extends EndpointOptions> = <M extends (requestData: OptionsRequestData<O>) => any>(controller: InstanceType<ControllerType>, propertyKey: string, descriptor: TypedPropertyDescriptor<M>) => void;
