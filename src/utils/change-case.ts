export function snakeCase(value: string): string {
	return value.replace(/(?:[^\w\d]+)?([A-Z]+)/g, (_: string, p: string) => `_${p.toLowerCase()}`).replace(/^_/, '');
}

export function parseName(name: string, postfix?: string): string {
	return snakeCase(typeof postfix === 'string' ? name.replace(new RegExp(`${postfix}$`), '') : name);
}
