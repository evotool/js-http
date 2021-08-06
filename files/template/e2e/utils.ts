import { HttpClient } from '@evojs/http-client';

export function createHttpClient(url: string): HttpClient {
	const http = new HttpClient();
	http.setUrl(url);

	return http;
}
