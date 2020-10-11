import { INJECT_OPTIONS_TOKEN, REQUEST_TOKEN, RESPONSE_TOKEN } from '../utils/tokens';

export function Inject(options: InjectOptions): ParameterDecorator;
export function Inject(token: TokenType, options?: InjectOptions): ParameterDecorator;
export function Inject(tokenOrOptions: TokenType | InjectOptions, options: InjectOptions = {}): ParameterDecorator {
	return (target, _, index) => {
		if (options.optional === void 0) {
			options.optional = false;
		}

		const buildOptions = (
			typeof tokenOrOptions === 'string' || typeof tokenOrOptions === 'function'
				? { provide: tokenOrOptions, ...options }
				: { ...tokenOrOptions }
		) as BuiltInject;

		Reflect.metadata(INJECT_OPTIONS_TOKEN, buildOptions)(target, index.toString());
	};
}

export const Req: ParameterDecorator = Inject(REQUEST_TOKEN);
export const Res: ParameterDecorator = Inject(RESPONSE_TOKEN);

export type InjectOptions = Partial<BuiltInject>;

export interface DepInjectOptions {
	provide: TokenType;
	optional?: boolean;
	default?: any;
}

export interface BuiltInject {
	provide: TokenType;
	optional: boolean;
	default?: any;
}

export type ProviderConstructor = new (...args: any[]) => any;
export type TokenType = ProviderConstructor | string;
