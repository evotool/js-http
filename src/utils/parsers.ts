/* eslint-disable @typescript-eslint/no-use-before-define */
import * as contentType from 'content-type';
import * as fs from 'fs';
import type { IncomingMessage } from 'http';
import * as path from 'path';
import type { Readable } from 'stream';
import * as unpipe from 'unpipe';

import {
	BadRequestException,
	HttpException,
	INTERNAL_HTTP_EXCEPTIONS,
	InternalServerErrorException,
	LengthRequiredException,
	PayloadTooLargeException,
	UnsupportedMediaTypeException,
} from '../classes/HttpException';
import { ParamSchema } from '../decorators/Endpoint';

export const BUFFER_ENCODINGS: BufferEncoding[] = ['ascii', 'utf8', 'utf-8', 'utf16le', 'ucs2', 'ucs-2', 'base64', 'latin1', 'binary', 'hex'];

const CONTENT_DISPOSITION_REGEX = /^content-disposition: form-data; *(.*)$/i;
const CONTENT_TYPE_REGEX = /^content-type: *([-\w.]+\/[-\w.+]+)$/i;

function halt(stream: Readable): void {
	unpipe(stream);

	if (typeof stream.pause === 'function') {
		stream.pause();
	}
}

function readBody(req: IncomingMessage, encoding: BufferEncoding, contentLengthLimit?: number): Promise<string>;
function readBody(req: IncomingMessage, encoding: undefined, contentLengthLimit?: number): Promise<Buffer>;
function readBody(req: IncomingMessage, encoding?: BufferEncoding | undefined, contentLengthLimit?: number): Promise<Buffer | string> {
	return new Promise<Buffer | string>((resolve, reject) => {
		if (!('content-length' in req.headers)) {
			reject(new LengthRequiredException(INTERNAL_HTTP_EXCEPTIONS.CONTENT_LENGTH_REQUIRED));
		}

		const length = +req.headers['content-length']!;

		let complete = false;

		if (typeof encoding === 'string' && !BUFFER_ENCODINGS.includes(encoding)) {
			return reject(new UnsupportedMediaTypeException(INTERNAL_HTTP_EXCEPTIONS.UNSUPPORTED_ENCODING, { encoding }));
		}

		// check the length and limit options.
		// note: we intentionally leave the stream paused,
		// so users should handle the stream themselves.
		if (length! > contentLengthLimit!) {
			halt(req);

			return reject(new PayloadTooLargeException(INTERNAL_HTTP_EXCEPTIONS.PAYLOAD_TOO_LARGE, { expected: length, contentLengthLimit }));
		}

		// streams1: assert request encoding is buffer.
		// streams2+: assert the stream encoding is buffer.
		//   stream._decoder: streams1
		//   state.encoding: streams2
		//   state.decoder: streams2, specifically < 0.10.6
		type IncomingMessageExtended = IncomingMessage & { _readableState: { encoding?: string; decoder?: any }; _decoder?: any };

		const state = (req as IncomingMessageExtended)._readableState;

		if ((req as IncomingMessageExtended)._decoder || (state && (state.encoding || state.decoder))) {
			halt(req);

			return reject(new InternalServerErrorException(INTERNAL_HTTP_EXCEPTIONS.STREAM_ENCODING_ENABLED, {}));
		}

		let received = 0;

		const data: Buffer[] = [];

		function cleanup(throwed?: boolean): void {
			if (complete) {
				return;
			}

			complete = true;

			if (throwed) {
				halt(req);
			}

			req
				.removeListener('error', onEnd)
				.removeListener('aborted', onAborted)
				.removeListener('data', onData)
				.removeListener('end', onEnd)
				.removeListener('close', cleanup);
		}

		function onAborted(): void {
			if (complete) {
				return;
			}

			cleanup(true);

			return reject(new BadRequestException(INTERNAL_HTTP_EXCEPTIONS.REQUEST_ABORTED, { code: 'ECONNABORTED', expected: length, received }));
		}

		function onData(chunk: Buffer): void {
			if (complete) {
				return;
			}

			received += chunk.byteLength;

			if (received > contentLengthLimit!) {
				cleanup(true);

				return reject(new PayloadTooLargeException(INTERNAL_HTTP_EXCEPTIONS.PAYLOAD_TOO_LARGE, { contentLengthLimit, received }));
			}

			data.push(chunk);
		}

		function onEnd(err: Error): void {
			if (complete) {
				return;
			}

			if (err || received !== length!) {
				cleanup(true);

				return reject(err || new BadRequestException(INTERNAL_HTTP_EXCEPTIONS.BAD_CONTENT_LENGTH, { expected: length, received }));
			}

			cleanup();

			const buffer = Buffer.concat(data);

			return resolve(typeof encoding === 'string' ? buffer.toString(encoding) : buffer);
		}

		req
			.on('error', onEnd)
			.on('aborted', onAborted)
			.on('data', onData)
			.on('end', onEnd)
			.on('close', cleanup);
	});
}

// parse multipart

export function parseMultipart(req: IncomingMessage, boundary: string, encoding: BufferEncoding = 'utf-8', options: MultipartOptions = {}): Promise<MultipartData> {
	return new Promise((resolve, reject) => {
		if (!('content-length' in req.headers)) {
			reject(new LengthRequiredException(INTERNAL_HTTP_EXCEPTIONS.CONTENT_LENGTH_REQUIRED));
		}

		const {
			filename = (file: MultipartFile): string => {
				if (file.filename) {
					return file.filename;
				}

				let out = '';

				while (out.length < 64) {
					out += Math.random().toString(16).substring(2);
				}

				return out.substring(0, length);
			},
			uploadsDirectory = path.resolve(options.uploadsDirectory || '.'),
			contentLengthLimit,
			maxFileSize,
			maxFieldSize,
		} = options;

		const length = +req.headers['content-length']!;
		const BOUNDARY = Buffer.from(`--${boundary}`, encoding);
		const CRLF = Buffer.from('\r\n', encoding);
		const THEEND = Buffer.from('--', encoding);
		const output: MultipartData = {};
		const mkdirOptions = { recursive: true };

		let complete = false;
		let received = 0;
		let state = 0,
			contentDispositionData: { [key: string]: string } = {},
			filetype = '',
			prevChunk: Buffer | undefined,
			startIndex = 0,
			prevStartIndex = 0;
		const writeFilePromises: Promise<string>[] = [];

		if (typeof encoding === 'string' && !BUFFER_ENCODINGS.includes(encoding as BufferEncoding)) {
			return reject(new UnsupportedMediaTypeException(INTERNAL_HTTP_EXCEPTIONS.UNSUPPORTED_ENCODING, { encoding }));
		}

		// check the length and limit options.
		// note: we intentionally leave the stream paused,
		// so users should handle the stream themselves.
		if (length! > contentLengthLimit!) {
			halt(req);

			return reject(new PayloadTooLargeException(INTERNAL_HTTP_EXCEPTIONS.PAYLOAD_TOO_LARGE, { expected: length, contentLengthLimit }));
		}

		function cleanup(throwed?: boolean): void {
			if (complete) {
				return;
			}

			complete = true;

			if (throwed) {
				void Promise.all(writeFilePromises.map(async (promise) => {
					try {
						const fp = await promise;
						fs.unlinkSync(fp);
					} catch (err) {
						console.debug(err);
					}
				}));

				halt(req);
			}

			req
				.removeListener('aborted', onAborted)
				.removeListener('data', onData)
				.removeListener('end', onEnd)
				.removeListener('error', onEnd)
				.removeListener('close', cleanup);
		}

		function onAborted(): void {
			if (complete) {
				return;
			}

			cleanup(true);

			return reject(new BadRequestException(INTERNAL_HTTP_EXCEPTIONS.REQUEST_ABORTED, { code: 'ECONNABORTED', expected: length, received }));
		}

		function onData(chunk: Buffer): void {
			if (complete) {
				return;
			}

			received += chunk.byteLength;

			if (received > contentLengthLimit!) {
				cleanup(true);

				return reject(new PayloadTooLargeException(INTERNAL_HTTP_EXCEPTIONS.PAYLOAD_TOO_LARGE, { contentLengthLimit, received }));
			}

			if (prevChunk) {
				chunk = Buffer.concat([prevChunk, chunk]);
				prevChunk = undefined;
			} else {
				startIndex = 0;
				prevStartIndex = 0;
			}

			const chunkByteLength = chunk.byteLength;

			while (startIndex < chunkByteLength) {
				if (0 === state) { // start boundary
					const endIndex = chunk.indexOf(BOUNDARY, prevStartIndex || startIndex);

					if (endIndex < 0) {
						prevStartIndex = chunkByteLength - BOUNDARY.length;
						prevChunk = chunk;

						return;
					}

					prevStartIndex = 0;

					startIndex = endIndex + BOUNDARY.length;

					if (chunk[startIndex] === THEEND[0] && chunk[startIndex + 1] === THEEND[1]) {
						return;
					}

					startIndex += CRLF.length;
					state = 1;

					continue;
				}

				if (1 === state) { // Content-Disposition
					const endIndex = chunk.indexOf(CRLF, prevStartIndex || startIndex);

					if (endIndex < 0) {
						prevStartIndex = chunkByteLength - CRLF.length;
						prevChunk = chunk;

						return;
					}

					prevStartIndex = 0;

					const contentDispositionLine = chunk.slice(startIndex, endIndex).toString(encoding);
					const m = CONTENT_DISPOSITION_REGEX.exec(contentDispositionLine);

					if (!m) {
						throw new Error();
					}

					contentDispositionData = {};

					for (const pair of m[1].split(/; */)) {
						const [key, value] = pair.split('=');
						contentDispositionData[key] = value.replace(/^"|"$/g, '');
					}

					startIndex = endIndex + CRLF.length;
					state = 2;

					continue;
				}

				if (2 === state) { // Content-Type
					const endIndex = chunk.indexOf(CRLF, prevStartIndex || startIndex);

					if (endIndex < 0) {
						prevStartIndex = chunkByteLength - CRLF.length;
						prevChunk = chunk;

						return;
					}

					prevStartIndex = 0;

					if (startIndex === endIndex) {
						filetype = '';
					} else {
						const contentTypeLine = chunk.slice(startIndex, endIndex).toString(encoding);

						const m = CONTENT_TYPE_REGEX.exec(contentTypeLine);

						if (!m) {
							throw new Error();
						}

						filetype = m[1];
						startIndex = endIndex + CRLF.length; // 2x crlf
					}

					startIndex += CRLF.length;
					state = 3;

					continue;
				}

				if (3 === state) { // Body
					let endIndex = chunk.indexOf(BOUNDARY, prevStartIndex || startIndex);

					if (endIndex < 0) {
						prevStartIndex = chunkByteLength - BOUNDARY.length;
						prevChunk = chunk;

						return;
					}

					endIndex -= CRLF.length;

					const part = contentDispositionData as unknown as MultipartFile;
					const b = chunk.slice(startIndex, endIndex);
					part.charset = BUFFER_ENCODINGS.includes(part.charset as BufferEncoding) ? part.charset as BufferEncoding : encoding;

					let data: File | string;
					let name: keyof typeof output;

					if (filetype) {
						if (b.byteLength > maxFileSize!) {
							throw new PayloadTooLargeException(INTERNAL_HTTP_EXCEPTIONS.PAYLOAD_TOO_LARGE, { maxFileSize, byteLength: b.byteLength });
						}

						part.filetype = filetype;
						part.filesize = b.byteLength;

						const f = path.resolve(uploadsDirectory!, filename!(part));
						const d = path.dirname(f);
						const o = { encoding: part.charset };

						writeFilePromises.push(new Promise<string>((r, t) => fs.mkdir(d, mkdirOptions, (e) => e ? t(e) : fs.writeFile(f, b, o, (e) => e ? t(e) : r(f)))));
						name = part.name;

						data = {
							path: f,
							name: part.filename,
							size: part.filesize,
							type: part.filetype,
							encoding: part.charset,
						};
					} else {
						if (b.byteLength > maxFieldSize!) {
							throw new PayloadTooLargeException(INTERNAL_HTTP_EXCEPTIONS.PAYLOAD_TOO_LARGE, { maxFieldSize, byteLength: b.byteLength });
						}

						name = part.name;
						data = b.toString(part.charset);
					}

					if (name in output) {
						if (Array.isArray(output[name])) {
							(output[name] as (string | File)[]).push(data);
						} else {
							output[name] = [output[name] as string | File, data];
						}
					} else {
						output[name] = data;
					}

					contentDispositionData = {};
					filetype = '';
					startIndex = endIndex + CRLF.length;
					state = 0;

					continue;
				}
			}
		}

		function onEnd(err: Error): void {
			if (complete) {
				return;
			}

			if (err || received !== length!) {
				cleanup(true);

				return reject(err || new BadRequestException(INTERNAL_HTTP_EXCEPTIONS.BAD_CONTENT_LENGTH, { expected: length, received }));
			}

			cleanup();

			void Promise.all(writeFilePromises.map(async (promise) => {
				try {
					await promise;
				} catch (err) {
					console.debug(err);
				}
			})).then(() => resolve(output));
		}

		req
			.on('error', onEnd)
			.on('aborted', onAborted)
			.on('data', onData)
			.on('end', onEnd)
			.on('close', cleanup);
	});
}

// parse body

const BodyTypes: { [key: string]: BodyType } = {
	'application/json': 'json',
	'application/x-www-form-urlencoded': 'urlencoded',
	'multipart/form-data': 'multipart',
};

export async function parseBody(req: IncomingMessage, bodyType: 'none', parsers: Parsers, options: BodyOptions): Promise<undefined>;
export async function parseBody(req: IncomingMessage, bodyType: 'json', parsers: Parsers, options: BodyOptions): Promise<JsonData>;
export async function parseBody(req: IncomingMessage, bodyType: 'urlencoded', parsers: Parsers, options: BodyOptions): Promise<UrlencodedData>;
export async function parseBody(req: IncomingMessage, bodyType: 'multipart', parsers: Parsers, options: MultipartOptions): Promise<MultipartData>;
export async function parseBody(req: IncomingMessage, bodyType: 'text', parsers: Parsers, options: BodyOptions): Promise<string>;
export async function parseBody(req: IncomingMessage, bodyType: 'raw', parsers: Parsers, options: BodyOptions): Promise<Buffer>;
export async function parseBody(req: IncomingMessage, bodyType: BodyType, parsers: Parsers, options: BodyOptions): Promise<undefined | string | Buffer | JsonData | UrlencodedData | MultipartData | Readable>;
export async function parseBody(req: IncomingMessage, bodyType: BodyType, parsers: Parsers, options: BodyOptions): Promise<undefined | string | Buffer | JsonData | UrlencodedData | MultipartData | Readable> {
	if (bodyType === 'none') {
		return void 0;
	}

	try {
		const { type, parameters } = contentType.parse(req);
		const contentLengthLimit = options.contentLengthLimit;
		const encoding = (parameters.charset || 'utf-8').toLowerCase() as BufferEncoding;

		if (BodyTypes[type] !== bodyType && (bodyType === 'json' || bodyType === 'urlencoded' || bodyType === 'multipart' || bodyType === 'text')) {
			throw new UnsupportedMediaTypeException(INTERNAL_HTTP_EXCEPTIONS.BAD_CONTENT_TYPE);
		}

		let raw: Buffer | string;

		if (bodyType === 'json' || bodyType === 'urlencoded' || bodyType === 'text') {
			raw = await readBody(req, encoding, contentLengthLimit);
		} else if (bodyType === 'raw') {
			raw = await readBody(req, void 0, contentLengthLimit);
		} else {
			return await parseMultipart(req, parameters.boundary, encoding, options as MultipartOptions);
		}

		if (bodyType === 'json') {
			return parsers.json.parse(raw as string) as JsonData;
		}

		if (bodyType === 'urlencoded') {
			return parsers.urlencoded.parse(raw as string) as UrlencodedData;
		}

		return raw;
	} catch (err) {
		if (!(err instanceof HttpException)) {
			throw new InternalServerErrorException(INTERNAL_HTTP_EXCEPTIONS.INTERNAL_SERVER_ERROR, { message: err.message, stack: err.stack });
		}

		throw err;
	}
}

// parse path

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
			parsedPath += `/:${param}`;

			if (regex || params[param]) {
				parsedPath += spattern;
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

// change case

export function snakeCase(value: string): string {
	return value.replace(/(?:[^\w\d]+)?([A-Z]+)/g, (_: string, p: string) => `_${p.toLowerCase()}`).replace(/^_/, '');
}

export function parseName(name: string, postfix?: string): string {
	return snakeCase(typeof postfix === 'string' ? name.replace(new RegExp(`${postfix}$`), '') : name);
}

export interface Parsers {
	json: {
		parse(text: string): any;
		stringify(value: any): string;
	};
	urlencoded: {
		queryMode?: boolean;
		parse(text: string): any;
		stringify(value: any): string;
	};
}

export type BodyType = 'none' | 'urlencoded' | 'json' | 'multipart' | 'text' | 'raw';

export type ApplicationBodyOptions = {
	multipart?: MultipartOptions;
} & Partial<Record<Exclude<BodyType, 'multipart'>, { contentLengthLimit?: number }>>;

export type BodyOptions = NonNullable<ApplicationBodyOptions[BodyType]>;

export interface MultipartOptions {
	contentLengthLimit?: number;
	maxFileSize?: number;
	maxFieldSize?: number;
	uploadsDirectory?: string;
	filename?(part: MultipartFile): string;
}

export type JsonData = string | number | boolean | null | object | JsonData[];

export interface UrlencodedData {
	[key: string]: string | string[];
}

export interface File {
	name: string;
	path: string;
	size: number;
	type: string;
	encoding: BufferEncoding;
}

export interface MultipartData {
	[key: string]: string | File | (string | File)[];
}

interface MultipartFile {
	filename: string;
	filesize: number;
	filetype: string;
	charset: BufferEncoding;
	name: string;
}
