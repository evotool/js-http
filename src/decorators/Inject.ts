import { findOrCreateInjectData } from '../utils/reflect';
import { InjectDecorator } from '../utils/types';

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
