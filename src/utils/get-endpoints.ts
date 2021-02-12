import type { ControllerConstructor } from '../decorators/Controller';
import type { BuiltEndpoint } from '../decorators/Endpoint';
import { CONTROLLER_ENDPOINTS_TOKEN } from './tokens';

export function getEndpoints(controllerConstructor: ControllerConstructor): BuiltEndpoint[] {
	let endpoints: BuiltEndpoint[];

	if (Reflect.hasMetadata(CONTROLLER_ENDPOINTS_TOKEN, controllerConstructor)) {
		endpoints = Reflect.getMetadata(CONTROLLER_ENDPOINTS_TOKEN, controllerConstructor);
	} else {
		endpoints = [];
		Reflect.metadata(CONTROLLER_ENDPOINTS_TOKEN, endpoints)(controllerConstructor);
	}

	return endpoints;
}
