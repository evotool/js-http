import { ObjectRule, PrimitiveRule, RuleType, SchemaType, ValidationRule, ValidationSchema } from '@evojs/validator';
import { IncomingMessage, ServerOptions, ServerResponse } from 'http';

export type Middleware = (req: IncomingMessage, res: ServerResponse) => any | PromiseLike<any>;

export interface Constructor<T = any> {
	new (...args: any[]): T;
	[key: string]: any;
}

// Application

export type Address = Readonly<{ host: string; port: number }>;
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
	controllers?: (Constructor | ImportOrRequireFn)[];

	/**
	 * @default {}
	 */
	hooks?: ApplicationHooks;

	/**
	 * @default []
	 */
	middlewares?: Middleware[];

	/**
	 * @default Parsers
	 */
	parsers?: Partial<Parsers>;

	/**
	 * @default []
	 */
	providers?: (Provider | ImportOrRequireFn)[];
	responseHandler?: ResponseHandler;
}

export interface ValueProvider {
	provide: any;
	useValue: any;
	scope?: Scope;
}

export interface ClassProvider {
	provide: any;
	useClass: Constructor;
	scope?: Scope;
	deps?: any[];
}

export interface FactoryProvider {
	provide: any;
	useFactory(...args: any[]): any;
	scope?: Scope;
	deps?: any[];
}

export type Provider =
| Constructor
| ValueProvider
| ClassProvider
| FactoryProvider;

export type ImportOrRequireFn = () => any | Promise<any>;

export interface ValueProviderData {
	provide: any;
	useValue: any;
	scope: Scope;
}

export interface ClassProviderData {
	provide: any;
	useClass: Constructor;
	scope: Scope;
	injects: InjectData[];
}

export interface FactoryProviderData {
	provide: any;
	useFactory(...args: any[]): any;
	scope: Scope;
	injects: InjectData[];
}

export type ProviderData =
| ValueProviderData
| ClassProviderData
| FactoryProviderData;

export interface ApplicationHooks {
	controllersLoad?(controllers: ControllerDataMap): void | PromiseLike<void>;
	providersLoad?(providers: ProviderData[]): void | PromiseLike<void>;
	endpointsLoad?(endpoints: EndpointData[]): void | PromiseLike<void>;
	middlewareExceptions?(middleware: Middleware, value: any): void | PromiseLike<void>;
}

export interface ApplicationData {
	bodyOptions: ApplicationBodyOptions;
	controllers: ControllerDataMap;
	endpoints: EndpointData[];
	hooks: ApplicationHooks;
	middlewares: Middleware[];
	parsers: Parsers;
	providers: ProviderData[];
	responseHandler?: ResponseHandler;
}

// Controller

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
export type InjectableDecorator = (constructor: Constructor) => void;
export type InjectDecorator = (constructor: Constructor, _: string, index: number) => void;

// Endpoint

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

export interface RequestData<Auth = any, Query = any, Body = any> {
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

export interface StaticBodyTypes {
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

export type OptionsRequestData<O extends EndpointOptions> = RequestData<AuthValue<O['authHandler']>, QueryValue<O['query']>, BodyValue<O['bodyType'], O['body'], O['bodyParser'], O['bodyRule']>>;
export type EndpointDecorator<O extends EndpointOptions> = <M extends (requestData: OptionsRequestData<O>) => any>(prototype: InstanceType<Constructor>, name: string, descriptor: TypedPropertyDescriptor<M>) => void;

// Injectable

export enum Scope {
	DEFAULT = 0,
	REQUEST = 1,
}

export interface InjectableOptions {
	scope?: Scope;
}

export interface InjectableData {
	injects: InjectData[];
	scope: Scope;
}

// Inject

export interface InjectData {
	token: any;
	optional?: boolean;
}

// parsers

export interface Parsers {
	json: {
		parse(text: string): any;
		stringify(value: any): string;
	};
	urlencoded: {
		queryMode?: boolean;
		parse(text: string): any;
		stringify(value: any): string;
	};
}

export type BodyType = 'none' | 'urlencoded' | 'json' | 'multipart' | 'text' | 'raw';

export type ApplicationBodyOptions = {
	multipart?: MultipartOptions;
} & Partial<Record<Exclude<BodyType, 'multipart'>, { contentLengthLimit?: number }>>;

export type BodyOptions = NonNullable<ApplicationBodyOptions[BodyType]>;

export interface MultipartOptions {
	contentLengthLimit?: number;
	maxFileSize?: number;
	maxFieldSize?: number;
	uploadsDirectory?: string;
	filename?(part: MultipartFile): string;
}

export type JsonData = string | number | boolean | null | object | JsonData[];

export interface UrlencodedData {
	[key: string]: string | string[];
}

export interface File {
	name: string;
	path: string;
	size: number;
	type: string;
	encoding: BufferEncoding;
}

export interface MultipartData {
	[key: string]: string | File | (string | File)[];
}

export interface MultipartFile {
	filename: string;
	filesize: number;
	filetype: string;
	charset: BufferEncoding;
	name: string;
}
