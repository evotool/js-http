import type { IncomingMessage } from 'http';

export function parseCookie(req: IncomingMessage): Cookies {
	const { cookie } = req.headers;
	const cookies: Cookies = {};

	if (cookie && cookie !== '') {
		const cookieItems = cookie.split(';');

		for (const item of cookieItems) {
			const [name, value] = item.trim().split('=')
				.map((x) => decodeURIComponent(x));

			if (cookies[name]) {
				cookies[name] = [cookies[name], value].flat();
			} else {
				cookies[name] = value;
			}
		}
	}

	return cookies;
}

export interface Cookies {
	[key: string]: string | string[];
}
