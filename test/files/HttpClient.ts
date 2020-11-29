/* eslint-disable @typescript-eslint/no-use-before-define */
import { parse as parseContentType } from 'content-type';
import * as FormData from 'form-data';
import { IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders, request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { parse as parseUrl, resolve as resolveUrl } from 'url';

import { Inject } from '../../src/decorators/Inject';
import { Injectable } from '../../src/decorators/Injectable';

export function stringifyQuery(query?: HttpQuery): string {
	if (!query) {
		return '';
	}

	return `?${Object
		.entries(query)
		.map(([key, value]) => {
			key = encodeURIComponent(key);

			if (Array.isArray(value)) {
				return value.map((v) => {
					if (typeof v === 'string') {
						return `${key}=${encodeURIComponent(v)}`;
					}

					if (typeof v === 'number' && isFinite(v)) {
						return `${key}=${encodeURIComponent(`${v}`)}`;
					}

					if (typeof v === 'boolean') {
						return `${key}=${v ? '1' : '0'}`;
					}

					if (v instanceof Date) {
						return `${key}=${v.toISOString()}`;
					}
				})
					.filter(Boolean)
					.join('&');
			}

			if (typeof value === 'string') {
				return `${key}=${encodeURIComponent(value)}`;
			}

			if (typeof value === 'number' && isFinite(value)) {
				return `${key}=${encodeURIComponent(`${value}`)}`;
			}

			if (typeof value === 'boolean') {
				return `${key}=${value ? '1' : '0'}`;
			}

			if (value instanceof Date) {
				return `${key}=${value.toISOString()}`;
			}
		})
		.filter(Boolean)
		.join('&')}`;
}

export class HttpHeaders {
	private readonly _map: Map<string, number | string | string[]>;
	constructor(headers: OutgoingHttpHeaders = {}) {
		this._map = new Map<string, number | string | string[]>(Object.entries(headers).map((entry) => {
			entry[0] = entry[0].toLowerCase();

			return entry;
		})
			.filter(([key, value]) => key && value !== undefined) as [string, number | string | string[]][]);
	}

	has(key: string): boolean {
		return this._map.has(key);
	}

	get(key: string): number | string | string[] | undefined {
		return this._map.get(key);
	}

	set(key: string, value: number | string | string[]): this {
		this._map.set(key.toLowerCase(), value);

		return this;
	}

	clear(): void {
		return this._map.clear();
	}

	delete(key: string): boolean {
		return this._map.delete(key);
	}

	toObject(): OutgoingHttpHeaders {
		return Object.fromEntries(this._map.entries());
	}
}

@Injectable()
export class HttpClient {
	private static readonly _logger: { debug(...args: any[]): void } = console;

	static request(options: CommonHttpRequestOptions, logger?: Logger): Promise<HttpResponse<string>>;
	static request(options: CommonHttpRequestOptions, logger?: Logger): Promise<HttpResponse<Buffer>>;
	static request<T>(options: CommonHttpRequestOptions, logger?: Logger): Promise<HttpResponse<T>>;
	static request<T>(options: CommonHttpRequestOptions, logger: Logger = this._logger): Promise<HttpResponse<T | string | Buffer | null>> {
		return new Promise<HttpResponse<T | string | Buffer | null>>((resolve, reject) => {
			let { method, url, headers, query, body } = options;

			const parsedUrl = parseUrl(url);
			parsedUrl.query = stringifyQuery(query);

			if (!parsedUrl.port) {
				parsedUrl.port = parsedUrl.protocol === 'https:' ? '443' : '80';
			}

			if (!(headers instanceof HttpHeaders)) {
				headers = new HttpHeaders(headers);
			}

			const requestOptions = {
				method,
				headers: headers.toObject(),
				protocol: `${parsedUrl.protocol || 'http:'}` as 'http:' | 'https:',
				hostname: parsedUrl.hostname,
				port: parsedUrl.port,
				path: (parsedUrl.path || '/') + parsedUrl.query,
			};

			if (body instanceof FormData) {
				body.submit(requestOptions, (err, res) => err ? reject(err) : callback(res));

				return;
			}

			const req = requestOptions.protocol === 'http:' ? httpRequest(requestOptions, callback) : httpsRequest(requestOptions, callback);

			function callback(res: IncomingMessage): void {
				if (res.statusCode! > 99 && res.statusCode!.toString().startsWith('2')) {
					logger.debug('request fail with code', res.statusCode);
				}

				interface BodyPromise extends HttpResponse<T | string | Buffer | null> {
					_body?: Promise<T | string | Buffer | null>;
				}

				const response: HttpResponse<T | string | Buffer | null> = {
					url: res.url!,
					method: res.method || method,
					statusCode: res.statusCode || 0,
					statusMessage: res.statusMessage || '',
					headers: res.headers,
					get completed(): boolean {
						return res.complete;
					},
					get destroyed(): boolean {
						return res.destroyed;
					},
					close(): void {
						res.connection.destroy();
						res.destroy();
					},
					body(this: BodyPromise): Promise<T | string | Buffer | null> {
						if (!this._body) {
							this._body = new Promise<T | string | Buffer | null>((r, t) => {
								if (this.destroyed) {
									return t(new Error('Destroyed connection'));
								}

								const chunks: string[] | Buffer[] = [];

								res.on('data', (chunk: string | Buffer) => {
									chunks.push(chunk as any);
								});

								res.on('end', () => {
									logger.debug(`${url} body end with ${chunks.length} chunks`);

									if (!res.headers['content-type'] && !chunks.length) {
										return r(null);
									}

									const { type } = parseContentType(res);

									switch (type) {
										case 'application/json':
											try {
												r(JSON.parse(chunks.join('')) as T);
											} catch (err) {
												t(err);
											}

											break;

										default:
											if (chunks[0] instanceof Buffer) {
												return r(Buffer.concat(chunks as Buffer[]));
											}

											r(chunks.join(''));

											break;
									}
								});

								res.on('error', (err) => {
									t(err);
								});
							});
						}

						return this._body;
					},
				};

				resolve(response);
			}

			let rejected = false;

			if (body && method !== 'GET' && method !== 'TRACE') {
				if (typeof body === 'object') {
					try {
						body = JSON.stringify(body);
					} catch (err) {
						return reject(err);
					}

					req.setHeader('Content-Length', Buffer.byteLength(body));
					req.setHeader('Content-Type', 'application/json; charset=utf-8');
				} else {
					req.setHeader('Content-Type', headers.get('content-type') || 'text/plain; charset=utf-8');
					req.setHeader('Content-Length', Buffer.byteLength(body));
				}

				req.write(body, (err) => {
					if (err) {
						reject(err);
						rejected = true;

						return;
					}
				});
			}

			req.on('error', (err) => {
				reject(err);
				rejected = true;
			});

			req.on('finish', () => {
				if (!rejected) {
					logger.debug(`${url} request finish`);
				}
			});

			req.end();
		});
	}

	static get<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>({
			method: 'GET',
			url,
			...options,
		});
	}

	static delete<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>({
			method: 'DELETE',
			url,
			...options,
		});
	}

	static trace<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>({
			method: 'TRACE',
			url,
			...options,
		});
	}

	static head<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>({
			method: 'HEAD',
			url,
			...options,
		});
	}

	static post<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>({
			method: 'POST',
			url,
			...options,
		});
	}

	static put<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>({
			method: 'PUT',
			url,
			...options,
		});
	}

	static patch<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>({
			method: 'PATCH',
			url,
			...options,
		});
	}

	private readonly url: string | undefined;

	constructor(@Inject('LOGGER', { optional: true }) private readonly _logger?: Logger) {}

	request<T>(options: CommonHttpRequestOptions): Promise<HttpResponse<T>> {
		return HttpClient.request<T>(options, this._logger);
	}

	get<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
		return HttpClient.request<T>({
			method: 'GET',
			url: this.url ? resolveUrl(this.url, url) : url,
			...options,
		}, this._logger);
	}

	delete<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return HttpClient.request<T>({
			method: 'DELETE',
			url: this.url ? resolveUrl(this.url, url) : url,
			...options,
		}, this._logger);
	}

	trace<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
		return HttpClient.request<T>({
			method: 'TRACE',
			url: this.url ? resolveUrl(this.url, url) : url,
			...options,
		}, this._logger);
	}

	head<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
		return HttpClient.request<T>({
			method: 'HEAD',
			url: this.url ? resolveUrl(this.url, url) : url,
			...options,
		}, this._logger);
	}

	post<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return HttpClient.request<T>({
			method: 'POST',
			url: this.url ? resolveUrl(this.url, url) : url,
			...options,
		}, this._logger);
	}

	put<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return HttpClient.request<T>({
			method: 'PUT',
			url: this.url ? resolveUrl(this.url, url) : url,
			...options,
		}, this._logger);
	}

	patch<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
		return HttpClient.request<T>({
			method: 'PATCH',
			url: this.url ? resolveUrl(this.url, url) : url,
			...options,
		}, this._logger);
	}
}

export type HttpMethod = 'GET' | 'TRACE' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface HttpQuery {
	[key: string]: boolean | number | string | Date | (boolean | number | string | Date)[] | undefined;
}

export interface HttpRequestOptions {
	headers?: HttpHeaders | { [key: string]: number | string | string[] };
	query?: HttpQuery;
	body?: any;
}

export interface CommonHttpRequestOptions {
	method: HttpMethod;
	url: string;
	headers?: HttpHeaders | { [key: string]: number | string | string[] };
	query?: HttpQuery;
	body?: any;
}

export interface HttpResponse<T> {
	url: string;
	method: string;
	statusCode: number;
	statusMessage: string;
	headers: IncomingHttpHeaders;
	completed: boolean;
	destroyed: boolean;
	body(): Promise<T>;
	close(): void;
}

export interface Logger {
	debug(...args: any[]): void;
}
