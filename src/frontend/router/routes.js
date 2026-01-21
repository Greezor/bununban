export default [
	{ path: '/', component: () => import('../pages/Home') },
	{ path: '/profiles', component: () => import('../pages/Profiles') },
	{ path: '/lists', component: () => import('../pages/Lists') },
	{ path: '/blobs', component: () => import('../pages/Blobs') },
	{ path: '/lua', component: () => import('../pages/Lua') },
	{ path: '/startup', component: () => import('../pages/Startup') },
	{ path: '/logs', component: () => import('../pages/Logs') },
	{ path: '/settings', component: () => import('../pages/Settings') },
]