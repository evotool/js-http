import {
	BadGatewayException,
	BadRequestException,
	ConflictException,
	ForbiddenException,
	GatewayTimeoutException,
	GoneException,
	HttpException,
	HttpVersionNotSupportedException,
	InternalServerErrorException,
	LengthRequiredException,
	MethodNotAllowedException,
	MisdirectedException,
	NotAcceptableException,
	NotFoundException,
	NotImplementedException,
	PayloadTooLargeException,
	PreconditionFailedException,
	RequestTimeoutException,
	ServiceUnavailableException,
	TooManyRequestsException,
	UnauthorizedException,
	UnprocessableEntityException,
	UnsupportedMediaTypeException,
	UriTooLongException,
} from '../src/classes/HttpException';

describe('exceptions', () => {
	it('should create ', () => {
		let ex: HttpException;

		ex = new BadRequestException('test message');
		expect(ex.message).toBe('test message');
		ex = new BadRequestException();
		expect(ex.statusCode).toBe(400);

		ex = new UnauthorizedException('test message');
		expect(ex.message).toBe('test message');
		ex = new UnauthorizedException();
		expect(ex.statusCode).toBe(401);

		ex = new ForbiddenException('test message');
		expect(ex.message).toBe('test message');
		ex = new ForbiddenException();
		expect(ex.statusCode).toBe(403);

		ex = new NotFoundException('test message');
		expect(ex.message).toBe('test message');
		ex = new NotFoundException();
		expect(ex.statusCode).toBe(404);

		ex = new MethodNotAllowedException('test message');
		expect(ex.message).toBe('test message');
		ex = new MethodNotAllowedException();
		expect(ex.statusCode).toBe(405);

		ex = new NotAcceptableException('test message');
		expect(ex.message).toBe('test message');
		ex = new NotAcceptableException();
		expect(ex.statusCode).toBe(406);

		ex = new RequestTimeoutException('test message');
		expect(ex.message).toBe('test message');
		ex = new RequestTimeoutException();
		expect(ex.statusCode).toBe(408);

		ex = new ConflictException('test message');
		expect(ex.message).toBe('test message');
		ex = new ConflictException();
		expect(ex.statusCode).toBe(409);

		ex = new GoneException('test message');
		expect(ex.message).toBe('test message');
		ex = new GoneException();
		expect(ex.statusCode).toBe(410);

		ex = new LengthRequiredException('test message');
		expect(ex.message).toBe('test message');
		ex = new LengthRequiredException();
		expect(ex.statusCode).toBe(411);

		ex = new PreconditionFailedException('test message');
		expect(ex.message).toBe('test message');
		ex = new PreconditionFailedException();
		expect(ex.statusCode).toBe(412);

		ex = new PayloadTooLargeException('test message');
		expect(ex.message).toBe('test message');
		ex = new PayloadTooLargeException();
		expect(ex.statusCode).toBe(413);

		ex = new UriTooLongException('test message');
		expect(ex.message).toBe('test message');
		ex = new UriTooLongException();
		expect(ex.statusCode).toBe(414);

		ex = new UnsupportedMediaTypeException('test message');
		expect(ex.message).toBe('test message');
		ex = new UnsupportedMediaTypeException();
		expect(ex.statusCode).toBe(415);

		ex = new MisdirectedException('test message');
		expect(ex.message).toBe('test message');
		ex = new MisdirectedException();
		expect(ex.statusCode).toBe(421);

		ex = new UnprocessableEntityException('test message');
		expect(ex.message).toBe('test message');
		ex = new UnprocessableEntityException();
		expect(ex.statusCode).toBe(422);

		ex = new TooManyRequestsException('test message');
		expect(ex.message).toBe('test message');
		ex = new TooManyRequestsException();
		expect(ex.statusCode).toBe(429);

		ex = new InternalServerErrorException('test message');
		expect(ex.message).toBe('test message');
		ex = new InternalServerErrorException();
		expect(ex.statusCode).toBe(500);

		ex = new NotImplementedException('test message');
		expect(ex.message).toBe('test message');
		ex = new NotImplementedException();
		expect(ex.statusCode).toBe(501);

		ex = new BadGatewayException('test message');
		expect(ex.message).toBe('test message');
		ex = new BadGatewayException();
		expect(ex.statusCode).toBe(502);

		ex = new ServiceUnavailableException('test message');
		expect(ex.message).toBe('test message');
		ex = new ServiceUnavailableException();
		expect(ex.statusCode).toBe(503);

		ex = new GatewayTimeoutException('test message');
		expect(ex.message).toBe('test message');
		ex = new GatewayTimeoutException();
		expect(ex.statusCode).toBe(504);

		ex = new HttpVersionNotSupportedException('test message');
		expect(ex.message).toBe('test message');
		ex = new HttpVersionNotSupportedException();
		expect(ex.statusCode).toBe(505);
	});
});
