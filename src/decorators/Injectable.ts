import { DESIGN_PARAMTYPES_TOKEN, INJECTABLE_OPTIONS_TOKEN, INJECT_OPTIONS_TOKEN } from '../utils/tokens';
import type { BuiltInject, DepInjectOptions, ProviderConstructor, TokenType } from './Inject';

export function Injectable(options: InjectableOptions = {}): ClassDecorator {
	return (target) => {
		const buildOptions = {} as BuiltInjectable;

		if (options.deps) {
			buildOptions.deps = options.deps.map((dep) => (typeof dep === 'object' ? { ...dep, optional: dep.optional ?? false } : { provide: dep, optional: false }));
		} else if (Reflect.hasMetadata(DESIGN_PARAMTYPES_TOKEN, target)) {
			const paramtypes = Reflect.getMetadata(DESIGN_PARAMTYPES_TOKEN, target) as ProviderConstructor[];

			buildOptions.deps = paramtypes
				.map((paramtype, i) => {
					const injectOptions = Reflect.getMetadata(INJECT_OPTIONS_TOKEN, target, `${i}`) as BuiltInject;

					if (injectOptions) {
						Reflect.deleteMetadata(INJECT_OPTIONS_TOKEN, target, `${i}`);

						return injectOptions;
					}

					return { provide: paramtype, optional: false };
				});

			Reflect.deleteMetadata(DESIGN_PARAMTYPES_TOKEN, target);
		} else {
			buildOptions.deps = [];
		}

		Reflect.metadata(INJECTABLE_OPTIONS_TOKEN, buildOptions.deps)(target);
	};
}

export interface InjectableOptions {
	deps?: (TokenType | DepInjectOptions)[];
}

export interface BuiltInjectable {
	deps: BuiltInject[];
}
