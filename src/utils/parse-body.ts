/* eslint-disable @typescript-eslint/no-use-before-define */
import * as contentType from 'content-type';
import * as fs from 'fs';
import type { IncomingMessage } from 'http';
import * as path from 'path';
import type { Readable } from 'stream';
import * as unpipe from 'unpipe';

import { HttpException } from '../classes/HttpException';

export const BUFFER_ENCODINGS: BufferEncoding[] = ['ascii', 'utf8', 'utf-8', 'utf16le', 'ucs2', 'ucs-2', 'base64', 'latin1', 'binary', 'hex'];

const CONTENT_DISPOSITION_REGEX = /^content-disposition: form-data; *(.*)$/i;
const CONTENT_TYPE_REGEX = /^content-type: *([-\w.]+\/[-\w.+]+)$/i;

function halt(stream: Readable): void {
	unpipe(stream);

	if (typeof stream.pause === 'function') {
		stream.pause();
	}
}

function randhash(length: number): string {
	let out = '';

	while (out.length < length) {
		out += Math.random().toString(16).substring(2);
	}

	return out.substring(0, length);
}

function filename(file: MultipartPart): string {
	if (file.filename) {
		return file.filename;
	}

	return randhash(64);
}

export function parseMultipart(req: IncomingMessage, boundary: string, encoding: BufferEncoding = 'utf-8', options: MultipartOptions = {}): Promise<MultipartData> {
	return new Promise((resolve, reject) => {
		options.filename ??= filename;
		options.uploadsDirectory = path.resolve(options.uploadsDirectory || '.');

		const contentLength = req.headers['content-length'];
		const length = contentLength === undefined ? undefined : +contentLength;
		const contentLengthLimit = options.contentLengthLimit;
		const BOUNDARY = Buffer.from(`--${boundary}`, encoding);
		const CRLF = Buffer.from('\r\n', encoding);
		const THEEND = Buffer.from('--', encoding);
		const output: MultipartData = {};
		const mkdirOptions = { recursive: true };

		let complete = false;
		let received = 0;
		let state = 0,
			contentDispositionData: { [key: string]: string } = {},
			mimetype = '',
			prevChunk: Buffer | undefined,
			startIndex = 0,
			prevStartIndex = 0;
		const writeFilePromises: Promise<string>[] = [];

		if (typeof encoding === 'string' && !BUFFER_ENCODINGS.includes(encoding as BufferEncoding)) {
			return reject(new HttpException(415, 'Specified encoding unsupported', { encoding }));
		}

		// check the length and limit options.
		// note: we intentionally leave the stream paused,
		// so users should handle the stream themselves.
		if (length! > contentLengthLimit!) {
			halt(req);

			return reject(new HttpException(413, 'Request entity too large', { expected: length, contentLengthLimit }));
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

			return reject(new HttpException(400, 'Request aborted', { code: 'ECONNABORTED', expected: length, received }));
		}

		function onData(chunk: Buffer): void {
			if (complete) {
				return;
			}

			received += chunk.byteLength;

			if (received > contentLengthLimit!) {
				cleanup(true);

				return reject(new HttpException(413, 'Request entity too large', { contentLengthLimit, received }));
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
						mimetype = '';
					} else {
						const contentTypeLine = chunk.slice(startIndex, endIndex).toString(encoding);

						const m = CONTENT_TYPE_REGEX.exec(contentTypeLine);

						if (!m) {
							throw new Error();
						}

						mimetype = m[1];
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

					const part = contentDispositionData as MultipartPart;
					const b = chunk.slice(startIndex, endIndex);
					part.charset = BUFFER_ENCODINGS.includes(part.charset as BufferEncoding) ? part.charset as BufferEncoding : encoding;

					let data: File | string;
					let name: keyof typeof output;

					if (mimetype) {
						if (b.byteLength > options.maxFileSize!) {
							throw new HttpException(400, `maxFileSize exceeded, received ${b.byteLength} bytes of file data`, { maxFileSize: options.maxFileSize, byteLength: b.byteLength });
						}

						part.mimetype = mimetype;
						part.path = path.resolve(options.uploadsDirectory!, options.filename!(part));
						part.size = b.byteLength;

						const f = part.path;
						const d = path.dirname(f);
						const o = { encoding: part.charset };

						writeFilePromises.push(new Promise<string>((r, t) => fs.mkdir(d, mkdirOptions, (e) => e ? t(e) : fs.writeFile(f, b, o, (e) => e ? t(e) : r(f)))));
						name = part.name;
						data = part as File;
						delete data.name;
					} else {
						if (b.byteLength > options.maxFieldSize!) {
							throw new HttpException(400, `maxFieldSize exceeded, received ${b.byteLength} bytes of field data`, { maxFieldSize: options.maxFieldSize, byteLength: b.byteLength });
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
					mimetype = '';
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

				return reject(err || new HttpException(400, 'Request size did not match content length', { expected: length, received }));
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

function readBody(req: IncomingMessage, encoding: BufferEncoding, contentLengthLimit?: number): Promise<string>;
function readBody(req: IncomingMessage, encoding: undefined, contentLengthLimit?: number): Promise<Buffer>;
function readBody(req: IncomingMessage, encoding?: BufferEncoding | undefined, contentLengthLimit?: number): Promise<Buffer | string> {
	return new Promise<Buffer | string>((resolve, reject) => {
		const contentLength = req.headers['content-length'];
		const length = contentLength === undefined ? undefined : +contentLength;

		let complete = false;

		if (typeof encoding === 'string' && !BUFFER_ENCODINGS.includes(encoding)) {
			return reject(new HttpException(415, 'Specified encoding unsupported', { encoding }));
		}

		// check the length and limit options.
		// note: we intentionally leave the stream paused,
		// so users should handle the stream themselves.
		if (length! > contentLengthLimit!) {
			halt(req);

			return reject(new HttpException(413, 'Request entity too large', { expected: length, contentLengthLimit }));
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

			return reject(new HttpException(500, 'Stream encoding should not be set', {}));
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

			return reject(new HttpException(400, 'Request aborted', { code: 'ECONNABORTED', expected: length, received }));
		}

		function onData(chunk: Buffer): void {
			if (complete) {
				return;
			}

			received += chunk.byteLength;

			if (received > contentLengthLimit!) {
				cleanup(true);

				return reject(new HttpException(413, 'Request entity too large', { contentLengthLimit, received }));
			}

			data.push(chunk);
		}

		function onEnd(err: Error): void {
			if (complete) {
				return;
			}

			if (err || received !== length!) {
				cleanup(true);

				return reject(err || new HttpException(400, 'Request size did not match content length', { expected: length, received }));
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

const BodyTypes: { [key: string]: BodyType } = {
	'application/json': 'json',
	'application/x-www-form-urlencoded': 'urlencoded',
	'multipart/form-data': 'multipart',
};

export async function parseBody(req: IncomingMessage, bodyType: 'none', parsers: Parsers, options: BodyOptions): Promise<undefined>;
export async function parseBody(req: IncomingMessage, bodyType: 'json', parsers: Parsers, options: BodyOptions): Promise<JsonData>;
export async function parseBody(req: IncomingMessage, bodyType: 'urlencoded', parsers: Parsers, options: BodyOptions): Promise<UrlencodedData>;
export async function parseBody(req: IncomingMessage, bodyType: 'multipart', parsers: Parsers, options: MultipartOptions): Promise<MultipartData>;
export async function parseBody(req: IncomingMessage, bodyType: 'stream', parsers: Parsers, options: BodyOptions): Promise<Readable>;
export async function parseBody(req: IncomingMessage, bodyType: 'text', parsers: Parsers, options: BodyOptions): Promise<string>;
export async function parseBody(req: IncomingMessage, bodyType: 'raw', parsers: Parsers, options: BodyOptions): Promise<Buffer>;
export async function parseBody(req: IncomingMessage, bodyType: BodyType, parsers: Parsers, options: BodyOptions): Promise<undefined | string | Buffer | JsonData | UrlencodedData | MultipartData | Readable>;
export async function parseBody(req: IncomingMessage, bodyType: BodyType, parsers: Parsers, options: BodyOptions): Promise<undefined | string | Buffer | JsonData | UrlencodedData | MultipartData | Readable> {
	if (bodyType === 'none') {
		return void 0;
	}

	try {
		if (!req.headers['content-type']) {
			throw new Error('Incorrect header "Content-Type"');
		}

		const { type, parameters } = contentType.parse(req);
		const contentLengthLimit = options.contentLengthLimit;
		const encoding = (parameters.charset || 'utf-8').toLowerCase() as BufferEncoding;

		switch (bodyType) {
			case 'json':
			{
				if (BodyTypes[type] !== bodyType) {
					throw new Error('Incorrect header "Content-Type"');
				}

				const raw = await readBody(req, encoding, contentLengthLimit);

				return parsers.json.parse(raw) as JsonData;
			}

			case 'urlencoded':
			{
				if (BodyTypes[type] !== bodyType) {
					throw new Error('Incorrect header "Content-Type"');
				}

				const raw = await readBody(req, encoding, contentLengthLimit);

				return parsers.urlencoded.parse(raw) as UrlencodedData;
			}

			case 'multipart':
			{
				if (BodyTypes[type] !== bodyType) {
					throw new Error('Incorrect header "Content-Type"');
				}

				const data = await parseMultipart(req, parameters.boundary, encoding, options as MultipartOptions);

				return data;
			}

			case 'stream':
				return req;

			case 'text': {
				if (!type.startsWith('text/')) {
					throw new Error('Incorrect header "Content-Type"');
				}

				const raw = await readBody(req, encoding, contentLengthLimit);

				return raw;
			}

			case 'raw':
			default: {
				const raw = await readBody(req, void 0, contentLengthLimit);

				return raw;
			}
		}
	} catch (err) {
		if (!(err instanceof HttpException)) {
			throw new HttpException(500, 'Internal Server Error', { message: err.message, stack: err.stack });
		}

		throw err;
	}
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

export type BodyType = 'none' | 'urlencoded' | 'json' | 'multipart' | 'text' | 'raw' | 'stream';

export type ApplicationBodyOptions = {
	multipart?: MultipartOptions;
} & Partial<Record<Exclude<BodyType, 'multipart'>, { contentLengthLimit?: number }>>;

export type BodyOptions = NonNullable<ApplicationBodyOptions[BodyType]>;

export interface MultipartOptions {
	contentLengthLimit?: number;
	maxFileSize?: number;
	maxFieldSize?: number;
	uploadsDirectory?: string;
	filename?(part: Omit<MultipartPart, 'path'>): string;
}

export type JsonData = string | number | boolean | null | object | JsonData[];

export interface UrlencodedData {
	[key: string]: string | string[];
}

export type File = Omit<MultipartPart, 'name'>;

export interface MultipartData {
	[key: string]: string | File | (string | File)[];
}

interface MultipartPart {
	mimetype: string;
	filename: string;
	charset: BufferEncoding;
	path: string;
	name: string;
	size: number;
	[key: string]: any;
}
