import { Inject, Injectable, Optional } from '../../src';

export const HELLO_PREFIX_TOKEN = 'HELLO_PREFIX';
export const HELLO_WELCOME_TOKEN = 'HELLO_WELCOME';

@Injectable()
export class ImportedService {
	constructor(
		@Inject(HELLO_PREFIX_TOKEN) @Optional() readonly prefix: string = 'Mr.',
		@Inject(HELLO_WELCOME_TOKEN) readonly welcome: string,
	) {}

	sayHello(name: string): string {
		return `Hello, ${this.prefix} ${name}. ${this.welcome}`;
	}
}
