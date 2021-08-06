import { createHttpClient } from './utils';

describe('index', () => {
  require('../src/main');

  const http = createHttpClient('http://localhost:3001');

  it('should get body from /', async () => {
    const res = await http.get('/hello');
    const body = await res.body();
    expect(body).toBeTruthy();
  });
});
