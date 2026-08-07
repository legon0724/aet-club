import { mkdir, writeFile } from 'node:fs/promises';

const worker = `const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const acceptsHtml = (request.headers.get('accept') || '').includes('text/html');
    let response = await env.ASSETS.fetch(request);

    if (request.method === 'GET' && acceptsHtml && response.status === 404) {
      response = await env.ASSETS.fetch(new Request(new URL('/index.html', url)));
    }

    const contentType = response.headers.get('content-type') || '';
    if (acceptsHtml && contentType.includes('text/html')) {
      const html = (await response.text()).replaceAll('__NC_ORIGIN__', url.origin);
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  },
};

export default worker;
`;

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/server/index.js', import.meta.url), worker, 'utf8');
