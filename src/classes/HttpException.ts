
export class HttpException extends Error {
	constructor(readonly statusCode: number = 500, message?: string, readonly details?: any) {
		super(message);
		Object.setPrototypeOf(this, HttpException.prototype);
	}
}
