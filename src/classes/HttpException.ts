export const INTERNAL_HTTP_EXCEPTIONS = {
  BAD_CONTENT_LENGTH: 'Request size did not match content length',
  BAD_CONTENT_TYPE: 'Specified content type not supported',
  CONTENT_LENGTH_REQUIRED: 'Content-Length required',
  ENDPOINT_NOT_FOUND: 'Endpoint not found',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
  PAYLOAD_TOO_LARGE: 'Request entity too large',
  REQUEST_ABORTED: 'Request aborted',
  STREAM_ENCODING_ENABLED: 'Stream encoding should not be set',
  UNSUPPORTED_ENCODING: 'Specified encoding unsupported',
};

export class HttpException extends Error {
  constructor(readonly statusCode: number = 500, message?: string, readonly details?: any) {
    super(message);
    Object.setPrototypeOf(this, HttpException.prototype);
  }
}

export class BadRequestException extends HttpException {
  static DEFAULT_MESSAGE = 'Bad Request';

  constructor(message?: string, details?: any) {
    super(400, message ?? BadRequestException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, BadRequestException.prototype);
  }
}

export class UnauthorizedException extends HttpException {
  static DEFAULT_MESSAGE = 'Unauthorized';

  constructor(message?: string, details?: any) {
    super(401, message ?? UnauthorizedException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, UnauthorizedException.prototype);
  }
}

export class ForbiddenException extends HttpException {
  static DEFAULT_MESSAGE = 'Forbidden';

  constructor(message?: string, details?: any) {
    super(403, message ?? ForbiddenException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, ForbiddenException.prototype);
  }
}

export class NotFoundException extends HttpException {
  static DEFAULT_MESSAGE = 'Not Found';

  constructor(message?: string, details?: any) {
    super(404, message ?? NotFoundException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, NotFoundException.prototype);
  }
}

export class MethodNotAllowedException extends HttpException {
  static DEFAULT_MESSAGE = 'Method Not Allowed';

  constructor(message?: string, details?: any) {
    super(405, message ?? MethodNotAllowedException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, MethodNotAllowedException.prototype);
  }
}

export class NotAcceptableException extends HttpException {
  static DEFAULT_MESSAGE = 'Not Acceptable';

  constructor(message?: string, details?: any) {
    super(406, message ?? NotAcceptableException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, NotAcceptableException.prototype);
  }
}

export class RequestTimeoutException extends HttpException {
  static DEFAULT_MESSAGE = 'Bad Request';

  constructor(message?: string, details?: any) {
    super(408, message ?? RequestTimeoutException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, RequestTimeoutException.prototype);
  }
}

export class ConflictException extends HttpException {
  static DEFAULT_MESSAGE = 'Conflict';

  constructor(message?: string, details?: any) {
    super(409, message ?? ConflictException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, ConflictException.prototype);
  }
}

export class GoneException extends HttpException {
  static DEFAULT_MESSAGE = 'Gone';

  constructor(message?: string, details?: any) {
    super(410, message ?? GoneException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, GoneException.prototype);
  }
}

export class LengthRequiredException extends HttpException {
  static DEFAULT_MESSAGE = 'Length Required';

  constructor(message?: string, details?: any) {
    super(411, message ?? LengthRequiredException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, LengthRequiredException.prototype);
  }
}

export class PreconditionFailedException extends HttpException {
  static DEFAULT_MESSAGE = 'Precondition Failed';

  constructor(message?: string, details?: any) {
    super(412, message ?? PreconditionFailedException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, PreconditionFailedException.prototype);
  }
}

export class PayloadTooLargeException extends HttpException {
  static DEFAULT_MESSAGE = 'Payload Too Large';

  constructor(message?: string, details?: any) {
    super(413, message ?? PayloadTooLargeException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, PayloadTooLargeException.prototype);
  }
}

export class UriTooLongException extends HttpException {
  static DEFAULT_MESSAGE = 'Uri Too Long';

  constructor(message?: string, details?: any) {
    super(414, message ?? UriTooLongException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, UriTooLongException.prototype);
  }
}

export class UnsupportedMediaTypeException extends HttpException {
  static DEFAULT_MESSAGE = 'Unsupported Media Type';

  constructor(message?: string, details?: any) {
    super(415, message ?? UnsupportedMediaTypeException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, UnsupportedMediaTypeException.prototype);
  }
}

export class MisdirectedException extends HttpException {
  static DEFAULT_MESSAGE = 'Misdirected';

  constructor(message?: string, details?: any) {
    super(421, message ?? MisdirectedException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, MisdirectedException.prototype);
  }
}

export class UnprocessableEntityException extends HttpException {
  static DEFAULT_MESSAGE = 'Unprocessable Entity';

  constructor(message?: string, details?: any) {
    super(422, message ?? UnprocessableEntityException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, UnprocessableEntityException.prototype);
  }
}

export class TooManyRequestsException extends HttpException {
  static DEFAULT_MESSAGE = 'Too Many Requests';

  constructor(message?: string, details?: any) {
    super(429, message ?? TooManyRequestsException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, TooManyRequestsException.prototype);
  }
}

export class InternalServerErrorException extends HttpException {
  static DEFAULT_MESSAGE = 'Internal Server Error';

  constructor(message?: string, details?: any) {
    super(500, message ?? InternalServerErrorException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, InternalServerErrorException.prototype);
  }
}

export class NotImplementedException extends HttpException {
  static DEFAULT_MESSAGE = 'Not Implented';

  constructor(message?: string, details?: any) {
    super(501, message ?? NotImplementedException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, NotImplementedException.prototype);
  }
}

export class BadGatewayException extends HttpException {
  static DEFAULT_MESSAGE = 'Bad Gateway';

  constructor(message?: string, details?: any) {
    super(502, message ?? BadGatewayException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, BadGatewayException.prototype);
  }
}

export class ServiceUnavailableException extends HttpException {
  static DEFAULT_MESSAGE = 'Service Unavailable';

  constructor(message?: string, details?: any) {
    super(503, message ?? ServiceUnavailableException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, ServiceUnavailableException.prototype);
  }
}

export class GatewayTimeoutException extends HttpException {
  static DEFAULT_MESSAGE = 'Gateway Timeout';

  constructor(message?: string, details?: any) {
    super(504, message ?? GatewayTimeoutException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, GatewayTimeoutException.prototype);
  }
}

export class HttpVersionNotSupportedException extends HttpException {
  static DEFAULT_MESSAGE = 'Http Version Not Supported';

  constructor(message?: string, details?: any) {
    super(505, message ?? HttpVersionNotSupportedException.DEFAULT_MESSAGE, details);
    Object.setPrototypeOf(this, HttpVersionNotSupportedException.prototype);
  }
}
