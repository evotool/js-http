import type { Constructor } from '../classes/Application';
import { findOrCreateInjectableData, setInjects } from '../utils/reflect';
import type { InjectData } from './Inject';

export const enum Scope {
  DEFAULT = 0,
  REQUEST = 1,
}

export function Injectable(options: InjectableOptions = {}): InjectableDecorator {
  return (constructor) => {
    const injectable = Object.assign(findOrCreateInjectableData(constructor), { scope: Scope.DEFAULT }, options) as InjectableData;
    setInjects(constructor, injectable);
  };
}

export type InjectableDecorator = (constructor: Constructor) => void;

export interface InjectableOptions {
  scope?: Scope;
}

export interface InjectableData {
  injects: InjectData[];
  scope: Scope;
}
