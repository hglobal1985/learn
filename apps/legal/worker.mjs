// Serves the public legal pages. Deployed as its own Worker so it never touches the main site.
import privacy from './privacy.html';
import support from './support.html';

const PAGES = { '/privacy': privacy, '/support': support };

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=300',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
};

export default {
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    const page = PAGES[pathname.replace(/\/$/, '')];
    if (page) return new Response(request.method === 'HEAD' ? null : page, { headers: HEADERS });
    return new Response('Not Found', { status: 404 });
  },
};
