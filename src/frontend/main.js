import { createApp } from 'vue/dist/vue.esm-bundler.js'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import Aura from '@primeuix/themes/aura'

import App from './App'
import router from './router/index'

globalThis.__VUE_OPTIONS_API__ = true
globalThis.__VUE_PROD_DEVTOOLS__ = false
globalThis.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false

const app = createApp(App)

app.use(router)

app.use(PrimeVue, {
	ripple: true,
    theme: {
		preset: {
			...Aura,
			semantic: {
				...Aura.semantic,
				primary: {
					50: '#fffde7',
					100: '#fff5b8',
					200: '#ffe983',
					300: '#ffdc4d',
					400: '#ffd226',
					500: '#ffcd19',
					600: '#ffc716',
					700: '#ffbf12',
					800: '#ffb70e',
					900: '#ffad09',
					950: '#ff9c03',
				},
			},
		},
		options: {
			darkModeSelector: false,
		},
	},
})

app.use(ConfirmationService)

app.mount('#app')