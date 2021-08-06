import { Injectable } from '@evojs/http';
import { HttpClient } from '@evojs/http-client';
import Logger from '@evojs/logger';

@Injectable()
export class HttpService extends HttpClient {
  constructor(logger: Logger) {
    super(logger.name('http'));
  }
}
