import { ParamSchema } from '../decorators/Endpoint';

const PATH_REGEX = /^:([a-z_$][a-z0-9_$]*)(\(.*\))?$/i;
const parsePathItem = (p: RegExp): string => `(${p.source.replace(/^\^|\$$/g, '').replace(/\$\|/g, '|').replace(/\|\^/g, '|')})`;

export function parsePath(path: string, params: ParamSchema): { path: string; pathRegex: RegExp; paramOrder: string[] } {
	const pathParts = path.split('/').filter(Boolean);

	const paramOrder: string[] = [];

	let parsedPath = '';
	let parsedPathRegex = '';

	for (const p of pathParts) {
		if (p.startsWith(':')) {
			const [param, regex] = Array.from(PATH_REGEX.exec(p) || []).slice(1) as [string, string?];

			if (!param) {
				throw new Error(`Bad path "/${path}"`);
			}

			paramOrder.push(param);

			const pattern = regex ? new RegExp(`^${regex}$`) : params[param] || new RegExp('^[^/]+$');
			const spattern = parsePathItem(pattern);

			parsedPathRegex += `/${spattern}`;

			if (regex || params[param]) {
				parsedPath += `/${spattern}`;
			}

			params[param] ??= pattern;
		} else {
			const part = `/${p.toLowerCase()}`;
			parsedPath += part;
			parsedPathRegex += part;
		}
	}

	return { path: parsedPath, pathRegex: new RegExp(`^${parsedPathRegex}/?$`, 'i'), paramOrder };
}
