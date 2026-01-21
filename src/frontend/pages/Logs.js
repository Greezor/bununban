import { ref, onActivated } from 'vue'
import { css } from '@emotion/css'

import ketchup from '../utils/ketchup'

import Loader from '../components/Loader'

const style = {
	page: css`
		padding: 10px 10px 100px;
		width: 100dvw;
		height: 100dvh;
		background: black;
		white-space: pre;
		font-family: monospace;
		color: #ccc;
		overflow: auto;
	`,
}

export default {
	setup()
	{
		const loading = ref(false);
		const logs = ref('');

		const loadLogs = async () => {
			loading.value = true;

			logs.value = '';

			const response = await ketchup.raw('/api/logs');
			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			while(true){
				const { done, value } = await reader.read();
				if( done ) break;

				const chunk = decoder.decode(value, { stream: true });
				logs.value += chunk;
				
				loading.value = false;
			}
		};

		onActivated(() => {
			loadLogs();
		});

		return { loading, logs };
	},
	template: `
		<div class="${ style.page }">{{ logs }}</div>
		<Loader v-if="loading" />
	`,
	components: {
		Loader,
	},
}