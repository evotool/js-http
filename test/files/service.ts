import { Inject, Injectable } from '../../src';

export const HELLO_PREFIX_TOKEN = 'HELLO_PREFIX';
export const HELLO_WELCOME_TOKEN = 'HELLO_WELCOME';

@Injectable()
export class ImportedService {
	constructor(
		@Inject(HELLO_PREFIX_TOKEN, { optional: true, default: 'Mr.' }) readonly prefix: string,
		@Inject(HELLO_WELCOME_TOKEN) readonly welcome: string,
	) {}

	sayHello(name: string): string {
		return `Hello, ${this.prefix} ${name}. ${this.welcome}`;
	}
}
