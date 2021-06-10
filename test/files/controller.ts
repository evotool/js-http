import { IncomingMessage, ServerResponse } from 'http';

import { Controller, Endpoint, RequestData } from '../../src';
import { ImportedService } from './service';

@Controller({
	path: 'imported',
	param: {},
	useMethodNames: true,
})
export class ImportedController {
	constructor(readonly req: IncomingMessage, readonly res: ServerResponse, readonly hello: ImportedService) {}

	@Endpoint({
		method: 'POST',
		body: {
			name: { type: 'string', min: 1 },
		},
	})
	sayHello({ body: { name } }: RequestData<null, {}, { name: string }>): { payload: string } {
		return { payload: this.hello.sayHello(name) };
	}

	@Endpoint({
		method: 'GET',
		path: 'hello/:name(\\w+)',
		authHandler: () => {},
	})
	sayHelloUrl({ params: { name } }: RequestData<void, {}, undefined>): { payload: string } {
		return { payload: this.hello.sayHello(name) };
	}
}
