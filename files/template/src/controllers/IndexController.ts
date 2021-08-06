import { Controller, Endpoint } from '@evojs/http';
import Logger from '@evojs/logger';

import { HttpService } from '../services/HttpService';
import { disabledAuth } from '../utils/auth-handlers';

@Controller({
  path: '',
  useMethodNames: true,
})
export class IndexController {
  constructor(
    readonly logger: Logger,
    readonly http: HttpService,
  ) {
  }

  @Endpoint({
    method: 'GET',
    query: {
      name: { type: 'string', optional: true },
    },
    authHandler: disabledAuth,
  })
  hello({ query: { name = 'world' } }: RequestNoAuth<any, { name?: string }>): string {
    const out = `Hello ${name}!`;

    if (Math.random() > 0.5) {
      throw new Error('');
    }

    return out;
  }
}
