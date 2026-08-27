import { createRouter, createWebHistory } from 'vue-router'
import { ofetch } from 'ofetch'

import routes from './routes'

const router = createRouter({
	history: createWebHistory(),
	routes,
})

router.beforeEach(async (to, from) => {
	const isAuthenticated = await ofetch('/api/auth/check');
	const isLoginPath = to.path === '/login';

	if( !isAuthenticated && !isLoginPath )
		return '/login';

	if( isAuthenticated && isLoginPath )
		return '/';
})

export default router