import { findOrCreateInjectableData, setInjects } from '../utils/reflect';
import { InjectableData, InjectableDecorator, InjectableOptions, Scope } from '../utils/types';

export function Injectable(options: InjectableOptions = {}): InjectableDecorator {
	return (constructor) => {
		const injectable = Object.assign(findOrCreateInjectableData(constructor), { scope: Scope.DEFAULT }, options) as InjectableData;
		setInjects(constructor, injectable);
	};
}
