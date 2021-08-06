import { getConnectionManager } from 'typeorm';

import ormconfig = require('../ormconfig');

const connectionManager = getConnectionManager();

export const connection = connectionManager.has(ormconfig.name!)
  ? connectionManager.get(ormconfig.name)
  : connectionManager.create(ormconfig);
