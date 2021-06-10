
import { addEndpointData } from '../utils/reflect';
import { EndpointData, EndpointDecorator, EndpointOptions } from '../utils/types';

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
