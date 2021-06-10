import { Constructor } from '../classes/Application';
import { ControllerData } from '../decorators/Controller';
import { EndpointData } from '../decorators/Endpoint';
import { InjectData } from '../decorators/Inject';
import { InjectableData } from '../decorators/Injectable';

const CONTROLLER_TOKEN = '@evojs/http:controller';
const INJECT_TOKEN = '@evojs/http:inject';
const INJECTABLE_TOKEN = '@evojs/http:injectable';
const DESIGN_PARAMTYPES_TOKEN = 'design:paramtypes';

function getParamtypes<T = any>(constructor: Constructor): T[] {
	return Reflect.getMetadata(DESIGN_PARAMTYPES_TOKEN, constructor) || [];
}

// controller

export function hasControllerData(constructor: Constructor): boolean {
	return Reflect.hasMetadata(CONTROLLER_TOKEN, constructor);
}

export function findControllerData(constructor: Constructor): ControllerData | undefined {
	return Reflect.getMetadata(CONTROLLER_TOKEN, constructor);
}

export function removeControllerData(constructor: Constructor): void {
	Reflect.deleteMetadata(CONTROLLER_TOKEN, constructor);
}

export function findOrCreateControllerData(constructor: Constructor): ControllerData {
	let controller = findControllerData(constructor);

	if (!controller) {
		controller = { endpoints: [] as EndpointData[] } as ControllerData;
		Reflect.metadata(CONTROLLER_TOKEN, controller)(constructor);
	}

	return controller;
}

// injectable

export function hasInjectableData(constructor: Constructor): boolean {
	return Reflect.hasMetadata(INJECTABLE_TOKEN, constructor);
}

export function findInjectableData(constructor: Constructor): InjectableData | undefined {
	return Reflect.getMetadata(INJECTABLE_TOKEN, constructor);
}

export function findOrCreateInjectableData(constructor: Constructor): InjectableData {
	let injectable = findInjectableData(constructor);

	if (!injectable) {
		injectable = {} as InjectableData;
		Reflect.metadata(INJECTABLE_TOKEN, injectable)(constructor);
	}

	return injectable;
}

export function removeInjectableData(constructor: Constructor): void {
	Reflect.deleteMetadata(INJECTABLE_TOKEN, constructor);
}

// inject

export function findInjectData(constructor: Constructor, index: number): InjectData | undefined {
	return Reflect.getMetadata(INJECT_TOKEN, constructor, `${index}`);
}

export function findOrCreateInjectData(constructor: Constructor, index: number): InjectData {
	let inject = findInjectData(constructor, index);

	if (!inject) {
		inject = {} as InjectData;
		Reflect.metadata(INJECT_TOKEN, inject)(constructor, `${index}`);
	}

	return inject;
}

export function setInjects(constructor: Constructor, injectable: InjectableData): void {
	injectable.injects = getParamtypes(constructor)
		.map((token, index) => {
			const inject = findInjectData(constructor, index);

			if (inject) {
				Reflect.deleteMetadata(INJECT_TOKEN, constructor, `${index}`);

				return inject;
			}

			return { token };
		});
}

// endpoints

export function addEndpointData(prototype: Object, endpointData: EndpointData): void {
	const controller = findOrCreateControllerData(prototype.constructor as Constructor);
	controller.endpoints.push(endpointData);
}
