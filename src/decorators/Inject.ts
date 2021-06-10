import { Constructor } from '../classes/Application';
import { findOrCreateInjectData } from '../utils/reflect';

export function Inject<T = any>(token?: T): InjectDecorator {
	return (constructor, _, index) => {
		const options = findOrCreateInjectData(constructor, index);

		options.token = token ?? constructor;

		if (options.token === void 0) {
			throw new Error('Invalid token');
		}
	};
}

export function Optional(): InjectDecorator {
	return (constructor, _, index) => {
		const options = findOrCreateInjectData(constructor, index);

		options.optional = true;
	};
}

export type InjectDecorator = (constructor: Constructor, _: string, index: number) => void;

export interface InjectData {
	token: any;
	optional?: boolean;
}
