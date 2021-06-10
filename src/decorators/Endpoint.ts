
import { ObjectRule, PrimitiveRule, RuleType, SchemaType, ValidationRule, ValidationSchema } from '@evojs/validator';
import { IncomingMessage, ServerResponse } from 'http';

import { Constructor, Middleware, ResponseHandler } from '../classes/Application';
import { BodyOptions, BodyType } from '../utils/parsers';
import { addEndpointData } from '../utils/reflect';

export function Endpoint<O extends EndpointOptions>(options: O = {} as O): EndpointDecorator<O> {
	return (prototype, name, descriptor) => {
		const endpoint = { ...options, name } as unknown as EndpointData;

		// set handler
		endpoint.handler = descriptor.value!;

		// set descriptor
		endpoint.descriptor = descriptor;

		// set queryRule if query exists
		if (endpoint.query && !endpoint.queryRule) {
			endpoint.queryRule = { type: 'object', schema: endpoint.query, parse: endpoint.queryParser };
			delete endpoint.query;
			delete endpoint.queryParser;
		}

		// set bodyRule if body exists
		if (endpoint.body && !endpoint.bodyRule) {
			endpoint.bodyRule = { type: 'object', schema: endpoint.body, parse: endpoint.bodyParser };
			delete endpoint.body;
			delete endpoint.bodyParser;
		}

		// set multipartOptions
		endpoint.bodyOptions ??= {};

		// set endpoint
		addEndpointData(prototype, endpoint);
	};
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
export type EndpointHandler = (request: Request) => any | PromiseLike<any>;

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
	middleware?: Middleware | Middleware[];
	responseHandler?: ResponseHandler;
	bodyOptions?: BodyOptions;
}

export interface EndpointData extends EndpointOptions {
	name: string;
	method: HttpMethod;
	controller: Constructor;
	handler: EndpointHandler;
	path: string;
	pathRegex: RegExp;
	paramOrder: string[];
	param: ParamSchema;
	descriptor: PropertyDescriptor;
	bodyType: BodyType;
	bodyOptions: BodyOptions;
}

export interface Request<Auth = any, Query = any, Body = any> {
	auth: Auth;
	query: Query;
	body: Body;
	params: Params;
	req: IncomingMessage;
	res: ServerResponse;
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

export type PromiseType<T> = T extends PromiseLike<any> ? Parameters<NonNullable<Parameters<T['then']>[0]>>[0] : T;

export type AuthValue<AH extends EndpointOptions['authHandler']> = AH extends (...args: any[]) => any ? PromiseType<ReturnType<AH>> : any;
export type QueryValue<Q extends EndpointOptions['query']> = Q extends ValidationSchema ? SchemaType<Q> : { [key: string]: string | string[] };
export type BodyValue<BT extends EndpointOptions['bodyType'], B extends EndpointOptions['body'], BP extends EndpointOptions['bodyParser'], BR extends EndpointOptions['bodyRule']> =
BT extends keyof StaticBodyTypes ? StaticBodyTypes[BT] :
	B extends ValidationSchema ? (BP extends (...args: any[]) => any ? ReturnType<BP> : SchemaType<B>) :
		BR extends PrimitiveRule[] ? RuleType<BR[number]> :
			BR extends PrimitiveRule ? RuleType<BR> : any;

type RequestEndpointOptions<O extends EndpointOptions> = Request<AuthValue<O['authHandler']>, QueryValue<O['query']>, BodyValue<O['bodyType'], O['body'], O['bodyParser'], O['bodyRule']>>;
export type EndpointDecorator<O extends EndpointOptions> = <M extends (request: RequestEndpointOptions<O>) => any>(prototype: InstanceType<Constructor>, name: string, descriptor: TypedPropertyDescriptor<M>) => void;
