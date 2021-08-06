# HTTP exceptions

## Existed HttpException classes

| code | class name                         |
| ---- | ---------------------------------- |
| 400  | `BadRequestException`              |
| 401  | `UnauthorizedException`            |
| 403  | `ForbiddenException`               |
| 404  | `NotFoundException`                |
| 405  | `MethodNotAllowedException`        |
| 406  | `NotAcceptableException`           |
| 408  | `RequestTimeoutException`          |
| 409  | `ConflictException`                |
| 410  | `GoneException`                    |
| 411  | `LengthRequiredException`          |
| 412  | `PreconditionFailedException`      |
| 413  | `PayloadTooLargeException`         |
| 414  | `UriTooLongException`              |
| 415  | `UnsupportedMediaTypeException`    |
| 421  | `MisdirectedException`             |
| 422  | `UnprocessableEntityException`     |
| 429  | `TooManyRequestsException`         |
| 500  | `InternalServerErrorException`     |
| 501  | `NotImplementedException`          |
| 502  | `BadGatewayException`              |
| 503  | `ServiceUnavailableException`      |
| 504  | `GatewayTimeoutException`          |
| 505  | `HttpVersionNotSupportedException` |

All classes extend `HttpException` class. `HttpException` class extends `Error` class.
