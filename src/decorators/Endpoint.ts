import { ObjectRule, PrimitiveRule, RuleType, SchemaType, ValidationRule, ValidationSchema } from '@evojs/validator';
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'http';

import { ResponseHandler } from '../classes/Application';
import { getEndpoints } from '../utils/get-endpoints';
import { BodyOptions, BodyType } from '../utils/parse-body';
import { Cookies } from '../utils/parse-cookie';
import { ControllerConstructor, MiddlewareType } from './Controller';

export function Endpoint<O extends EndpointOptions>(options: O = {} as O): EndpointDecorator<O> {
	return (controller, propertyKey, descriptor) => {
		const buildOptions = { ...options, name: propertyKey } as unknown as BuiltEndpoint;

		// set handler
		buildOptions.handler = descriptor.value!;

		// set descriptor
		buildOptions.descriptor = descriptor;

		// set queryRule if query exists
		if (buildOptions.query && !buildOptions.queryRule) {
			buildOptions.queryRule = { type: 'object', schema: buildOptions.query, parse: buildOptions.queryParser };
			delete buildOptions.query;
			delete buildOptions.queryParser;
		}

		// set bodyRule if body exists
		if (buildOptions.body && !buildOptions.bodyRule) {
			buildOptions.bodyRule = { type: 'object', schema: buildOptions.body, parse: buildOptions.bodyParser };
			delete buildOptions.body;
			delete buildOptions.bodyParser;
		}

		// set multipartOptions
		buildOptions.bodyOptions ??= {};

		// set endpoint
		const endpoints = getEndpoints(controller.constructor as ControllerConstructor);
		endpoints.push(buildOptions);
	};
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
export type EndpointHandler = (request: RequestData) => any | PromiseLike<any>;

export interface EndpointOptions {
	path?: string;
	param?: ParamSchema;
	method?: HttpMethod;
	query?: ValidationSchema;
	queryRule?: ValidationRule;
	queryParser?(x: any, rule: ObjectRule): any;
	body?: ValidationSchema;
	bodyRule?: ValidationRule;
	bodyType?: BodyType;
	bodyParser?(x: any, rule: ObjectRule): any;
	authHandler?: AuthHandler | null;
	middleware?: MiddlewareType | MiddlewareType[];
	responseHandler?: ResponseHandler;
	bodyOptions?: BodyOptions;
}

export interface BuiltEndpoint extends EndpointOptions {
	name: string;
	method: HttpMethod;
	controller: ControllerConstructor;
	handler: EndpointHandler;
	path: string;
	pathRegex: RegExp;
	paramOrder: string[];
	param: ParamSchema;
	descriptor: PropertyDescriptor;
	bodyType: BodyType;
	bodyOptions: BodyOptions;
}

export interface RequestData<Auth = any, Query = any, Body = any> {
	method: HttpMethod;
	auth: Auth;
	query: Query;
	body: Body;
	params: Params;
	cookies: Cookies;
	headers: IncomingHttpHeaders;
}

export interface Params {
	[key: string]: string;
}

export interface ParamSchema {
	[key: string]: RegExp;
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
type EndpointDecorator<O extends EndpointOptions> = <M extends (requestData: OptionsRequestData<O>) => any>(controller: InstanceType<ControllerConstructor>, propertyKey: string, descriptor: TypedPropertyDescriptor<M>) => void;
