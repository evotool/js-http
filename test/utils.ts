import { isDeepStrictEqual } from 'util';

import { Application, ApplicationOptions } from '../src';

export function createApplication(options?: ApplicationOptions): Promise<Application> {
	return Application.create(options);
}

export async function startApplication(app: Application, port: number, host: string = 'localhost'): Promise<Application> {
	expect(app.address).toBeNull();

	app = await app.listen(port);

	expect(isDeepStrictEqual(app.address, { host, port })).toBe(true);

	return app;
}

export async function stopApplication(app: Application): Promise<Application> {
	expect(app.address).toBeTruthy();

	app = await app.close();

	expect(app.address).toBeNull();

	return app;
}
