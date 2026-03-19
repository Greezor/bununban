import html from '../../frontend/index.html'
import vueRoutes from '../../frontend/router/routes'

const routes = {}

if( process.env.NODE_ENV === 'development' ){
	Object.assign(routes, ...(
		vueRoutes.map(({ path }) => ({ [path]: html }))
	));
}
else
{
	const cacheHeaders = {
		'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
		'pragma': 'no-cache',
		'expires': '0',
	};

	Object.assign(routes, ...(
		vueRoutes.map(({ path }) => ({
			[path]: new Response(Bun.file(html.index), {
				headers: {
					'content-type': 'text/html; charset=utf-8',
					...cacheHeaders,
				},
			}),
		}))
	), ...(
		html.files.map(({ path, headers }) => ({
			[path.replace('B:/~BUN/root', '')]: new Response(Bun.file(path), {
				headers: {
					'content-type': headers['content-type'],
					...cacheHeaders,
				},
			}),
		}))
	));
}

export default routes