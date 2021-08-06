import { AssertionError } from 'assert';
import type { IncomingMessage } from 'http';

export const applogger = console.name('app');
export const dbLogger = console.name('db');
export const reqlogger = console.name('req');

export function getRemoteAddress(req: IncomingMessage): string | undefined {
  return (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress) as string | undefined;
}

export function assertEnv<O extends NodeJS.Dict<string>, K extends keyof O>(envMap: O, ...keys: K[]): asserts envMap is O & { [P in K]: string } {
  for (const k of keys) {
    const v = envMap[k];

    if (typeof v !== 'string') {
      throw new AssertionError({ message: `Value of "${k}" should be defined` });
    }
  }
}

export function parseCookie(req: IncomingMessage): Cookies {
  const { cookie } = req.headers;
  const cookies: Cookies = {};

  if (cookie && cookie !== '') {
    const cookieItems = cookie.split(';');

    for (const item of cookieItems) {
      const [name, value] = item.trim().split('=')
        .map((x) => decodeURIComponent(x));

      if (cookies[name]) {
        cookies[name] = [cookies[name], value].flat();
      } else {
        cookies[name] = value;
      }
    }
  }

  return cookies;
}

export type Cookies = Record<string, string | string[]>;
