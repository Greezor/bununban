import { ref, shallowRef, onActivated, onDeactivated } from 'vue'
import { css } from '@emotion/css'

import ketchup from '../../common/utils/ketchup'

import Loader from '../components/Loader'

const style = {
	page: css`
		position: relative;
		width: 100dvw;
		height: 100dvh;
		background: black;
		white-space: pre;
		font-family: monospace;
		font-size: 16px;
		line-height: 20px;
		color: #ccc;
		overflow: auto;
	`,

	log: css`
		--top: 0px;
		padding: 0 10px;
		position: absolute;
		top: calc(10px + var(--top));
		left: 0px;

		&:last-child{
			padding-bottom: 100px;
		}
	`,
}

export default {
	setup()
	{
		const loading = ref(false);
		const scroll = ref(0);
		const viewportScroll = ref(0);
		const viewportHeight = ref(0);
		const logs = ref([]);

		const logsController = shallowRef(null);

		const loadLogs = async () => {
			logsController.value?.abort?.();
			
			loading.value = true;
			scroll.value = 0;
			viewportHeight.value = window.innerHeight;
			logs.value = [];
			logsController.value = new AbortController();

			const response = await ketchup.raw('/api/logs', {
				signal: logsController.signal,
			});

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			let tail = '';

			while( !logsController.value.signal.aborted ){
				const { done, value } = await reader.read();
				if( done ) break;

				const chunk = decoder.decode(value, { stream: true });

				const lines = (tail + chunk)
					.split(/\r?\n/);

				tail = lines.pop();

				logs.value.push( ...lines );

				await new Promise(resolve => setTimeout(resolve));
				
				loading.value = false;
			}

			logs.value.push( tail );
		};

		const rafID = shallowRef(null);

		const loop = () => {
			rafID.value = requestAnimationFrame(loop);
			viewportScroll.value = scroll.value;
		}

		onActivated(() => {
			loadLogs();
			loop();
		});

		onDeactivated(() => {
			logsController.value?.abort?.();
			cancelAnimationFrame(rafID.value);
			logs.value = [];
		});

		return { loading, scroll, viewportScroll, viewportHeight, logs };
	},
	template: `
		<div
			class="${ style.page }"
			@scroll="scroll = $event.target.scrollTop">
			<template v-for="(log, i) in logs">
				<div
					v-if="(
						i === logs.length - 1
						||
						( viewportScroll - viewportHeight * 2 <= 20 * i && viewportScroll + viewportHeight * 3 >= 20 * (i + 1) )
					)"
					class="${ style.log }"
					:style="{ '--top': ( 20 * i ) + 'px' }">
					{{ log }}
				</div>
			</template>
		</div>

		<Loader v-if="loading" />
	`,
	components: {
		Loader,
	},
}