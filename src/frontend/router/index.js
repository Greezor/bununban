import { createRouter, createWebHistory } from 'vue-router'

import routes from './routes'
import ketchup from '../../common/utils/ketchup'

const router = createRouter({
	history: createWebHistory(),
	routes,
})

router.beforeEach(async (to, from) => {
	const isAuthenticated = await ketchup('/api/auth/check');
	const isLoginPath = to.path === '/login';

	if( !isAuthenticated && !isLoginPath )
		return '/login';

	if( isAuthenticated && isLoginPath )
		return '/';
})

export default router