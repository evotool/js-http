/* eslint-disable @typescript-eslint/no-use-before-define */
import * as contentType from 'content-type';
import { IncomingForm } from 'formidable';
import { mkdirSync } from 'fs';
import type { IncomingMessage } from 'http';
import { join as pathJoin } from 'path';
import type { Readable } from 'stream';
import * as unpipe from 'unpipe';

import { HttpException } from '../classes/HttpException';

export function parseMultipart(req: IncomingMessage, options: MultipartOptions = {}): Promise<MultipartData> {
	return new Promise<MultipartData>((resolve, reject) => {
		if (!options.uploadDir) {
			options.uploadDir = 'tmp';
		}

		mkdirSync(options.uploadDir, { recursive: true });

		if (typeof options.keepExtensions !== 'boolean') {
			options.keepExtensions = true;
		}

		type IncomingFormExtended = IncomingForm & { _uploadPath(this: IncomingForm, filename: string): string };

		const form = new IncomingForm(options as any) as IncomingFormExtended;

		if (options.filename) {
			form._uploadPath = function (filename: string): string {
				const name = options.filename!(filename);

				return pathJoin(this.uploadDir, name);
			};
		}

		form.parse(req, (err: Error | null, fields: Record<string, string | string[]>, files: Record<string, File | File[]>) => {
			if (err) {
				reject(err);

				return;
			}

			resolve({ ...fields, ...files });
		});
	});
}

function halt(stream: Readable): void {
	unpipe(stream);

	if (typeof stream.pause === 'function') {
		stream.pause();
	}
}

function readBody(req: IncomingMessage, encoding: string, limit?: number): Promise<string>;
function readBody(req: IncomingMessage, encoding: undefined, limit?: number): Promise<Buffer>;
function readBody(req: IncomingMessage, encoding?: string | undefined, limit?: number): Promise<Buffer | string> {
	return new Promise<Buffer | string>((resolve, reject) => {
		const contentLength = req.headers['content-length'];
		const length = contentLength === void 0 ? void 0 : +contentLength;

		let complete = false;

		if (typeof encoding === 'string' && encoding !== 'utf-8') {
			return reject(new HttpException(415, 'specified encoding unsupported', { encoding }));
		}

		// check the length and limit options.
		// note: we intentionally leave the stream paused,
		// so users should handle the stream themselves.
		if (length! > limit!) {
			halt(req);

			return reject(new HttpException(413, 'request entity too large', {
				expected: length,
				limit,
			}));
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

			return reject(new HttpException(500, 'stream encoding should not be set', {}));
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

			req.removeListener('aborted', onAborted);
			req.removeListener('data', onData);
			req.removeListener('end', onEnd);
			req.removeListener('error', onEnd);
			req.removeListener('close', cleanup);
		}

		function onAborted(): void {
			if (complete) {
				return;
			}

			cleanup(true);

			return reject(new HttpException(400, 'request aborted', { code: 'ECONNABORTED', expected: length, received }));
		}

		function onData(chunk: Buffer): void {
			if (complete) {
				return;
			}

			received += chunk.length;

			if (received > limit!) {
				cleanup(true);

				return reject(new HttpException(413, 'request entity too large', { limit, received }));
			}

			data.push(chunk);
		}

		function onEnd(err: Error): void {
			if (complete) {
				return;
			}

			if (err || received !== length!) {
				cleanup(true);

				return reject(err || new HttpException(400, 'request size did not match content length', { expected: length, received }));
			}

			cleanup();

			const buffer = Buffer.concat(data);

			return resolve(typeof encoding === 'string' ? buffer.toString(encoding as 'utf-8') : buffer);
		}

		req.on('aborted', onAborted);
		req.on('close', cleanup);
		req.on('data', onData);
		req.on('end', onEnd);
		req.on('error', onEnd);
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
export async function parseBody(req: IncomingMessage, bodyType: 'multipart', parsers: Parsers, options: BodyOptions): Promise<MultipartData>;
export async function parseBody(req: IncomingMessage, bodyType: 'stream', parsers: Parsers, options: BodyOptions): Promise<Readable>;
export async function parseBody(req: IncomingMessage, bodyType: 'text', parsers: Parsers, options: BodyOptions): Promise<string>;
export async function parseBody(req: IncomingMessage, bodyType: 'raw', parsers: Parsers, options: BodyOptions): Promise<Buffer>;
export async function parseBody(req: IncomingMessage, bodyType: BodyType, parsers: Parsers, options: BodyOptions): Promise<undefined | string | Buffer | JsonData | UrlencodedData | MultipartData | Readable>;
export async function parseBody(req: IncomingMessage, bodyType: BodyType, parsers: Parsers, options: BodyOptions): Promise<undefined | string | Buffer | JsonData | UrlencodedData | MultipartData | Readable> {
	if (bodyType === 'none') {
		return void 0;
	}

	if (!req.headers['content-type']) {
		throw new HttpException(400, void 0, new Error('Incorrect header "Content-Type"'));
	}

	const { type, parameters } = contentType.parse(req);

	const limit = options[bodyType]?.limit;
	const encoding = (parameters.charset || 'utf-8').toLowerCase();

	try {
		switch (bodyType) {
			case 'json':
			{
				if (BodyTypes[type] !== bodyType) {
					throw new HttpException(400, void 0, new Error('Incorrect header "Content-Type"'));
				}

				const raw = await readBody(req, encoding, limit);

				return parsers.json.parse(raw) as JsonData;
			}

			case 'urlencoded':
			{
				if (BodyTypes[type] !== bodyType) {
					throw new HttpException(400, void 0, new Error('Incorrect header "Content-Type"'));
				}

				const raw = await readBody(req, encoding, limit);

				return parsers.urlencoded.parse(raw) as UrlencodedData;
			}

			case 'multipart':
			{
				if (BodyTypes[type] !== bodyType) {
					throw new HttpException(400, void 0, new Error('Incorrect header "Content-Type"'));
				}

				const data = await parseMultipart(req, options.multipart);

				return data;
			}

			case 'stream':
				return req;

			case 'text': {
				if (!type.startsWith('text/')) {
					throw new HttpException(400, void 0, new Error('Incorrect header "Content-Type"'));
				}

				const raw = await readBody(req, encoding, limit);

				return raw;
			}

			case 'raw':
			default: {
				const raw = await readBody(req, void 0, limit);

				return raw;
			}
		}
	} catch (err) {
		if (!(err instanceof HttpException)) {
			throw new HttpException(400, 'Bad Request', err);
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

export interface BodyOptions extends Partial<Record<BodyType, { limit?: number }>> {
	multipart?: {
		limit?: number;
	} & MultipartOptions;
}

export interface MultipartOptions {
	encoding?: string;
	uploadDir?: string;
	keepExtensions?: boolean;
	maxFileSize?: number;
	maxFieldsSize?: number;
	maxFields?: number;
	hash?: string | boolean;
	multiples?: boolean;
	filename?(filename: string): string;
}

export interface File {
	size: number;
	path: string;
	name: string;
	type: string;
}

export type JsonData = string | number | boolean | null | object | JsonData[];

export interface UrlencodedData {
	[key: string]: string | string[];
}

export interface MultipartData {
	[key: string]: string | string[] | File | File[];
}
