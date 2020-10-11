const REGEX_REPLACE = /(?:^(\^))|(?:(\$)\|)|(?:\|(\^))|(?:(\$)$)/g;

const parsePathItem = (p: RegExp | string): string => (p instanceof RegExp ? `(${p.source.replace(REGEX_REPLACE, '')})` : p.toLowerCase());

export function parsePath(path: string | (string | RegExp)[]): string {
	if (typeof path === 'string') {
		return path.toLowerCase();
	}

	return path.filter(Boolean).map(parsePathItem).join('/');
}
