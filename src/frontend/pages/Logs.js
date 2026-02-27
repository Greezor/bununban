import { ref, shallowRef, computed, onActivated, onDeactivated, useTemplateRef } from 'vue'
import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

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
		user-select: text;
	`,

	log: css`
		--top: 0px;
		padding: 0 10px;
		position: absolute;
		top: 0px;
		left: 0px;
		transform: translateY(calc(100px + var(--top)));

		&:last-child{
			padding-bottom: 100px;
		}

		&.focus{
			background-color: #ccc;
			color: #000;
		}
	`,
	
	search: css`
		position: fixed;
		padding: 20px;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		pointer-events: none;
		user-select: none;
		z-index: 2;
	`,

	searchbar: css`
		--main-color: #111;
		--secondary-color: #fff;
		margin: auto;
		padding: 0 25px;
		font-family: system-ui, sans-serif;
		font-size: 14px;
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1 1 auto;
		max-width: 538px;
		height: 58px;
		border-radius: 100px;
		pointer-events: auto;
		overflow: hidden;

		> input{
			flex: 1 1 auto;
			min-width: 0;
			height: 100%;
			background-color: transparent;
			border: none;
			font-family: inherit;
			font-size: inherit;
			color: inherit;

			&:focus{
				outline: none;
			}
		}
	`,

	searchIcon: css`
		margin-right: 10px;
		font-size: 26px;
		flex: 0 0 26px;
	`,

	searchNavBtn: css`
		border-radius: 100px;
		font-size: 18px;
		flex: 0 0 18px;
		cursor: pointer;

		&:hover{
			background-color: rgb(from #fff r g b / 0.1);
		}
	`,

	searchQty: css`
		padding-left: 10px;
		border-left: 1px solid rgb(from currentColor r g b / 0.3);
	`,

	highlighted: css`
		background-color: #ffcd19;
		color: #000;
	`,
}

export default {
	setup()
	{
		const loading = ref(false);
		const scroll = ref(0);
		const viewportHeight = ref(0);
		const logs = ref([]);
		const search = ref('');
		const currentFoundLog = ref(0);
		const foundLogsTotal = ref(0);
		const pageEl = useTemplateRef('page');

		const foundLogs = computed(() => {
			if( !search.value )
				return [];

			return logs.value
				.map((log, i) => ({ i, log }))
				.filter(({ log }) => (
					new RegExp(search.value, 'gi').test(log)
				));
		});

		const visibleLogs = computed(() => (
			logs.value
				.map((log, i) => ({
					i,
					log,
					styledLog: (
						search.value
							? log.replace(
								new RegExp(`(${ search.value })`, 'gi'),
								`<span class="${ style.highlighted }">$1</span>`
							)
							: log
					),
				}))
				.filter((_, i) => (
					scroll.value - viewportHeight.value * 1 <= 20 * i
					&&
					scroll.value + viewportHeight.value * 2 >= 20 * (i + 1)
				))
		));

		const navigateSearchResults = index => {
			if( !foundLogs.value.length ){
				currentFoundLog.value = 0;
				foundLogsTotal.value = 0;
				return;
			}

			index ??= currentFoundLog.value;

			if( index >= foundLogs.value.length )
				index = 0;

			if( index < 0 )
				index = foundLogs.value.length - 1;

			if( foundLogsTotal.value != foundLogs.value.length || currentFoundLog.value != index ){
				currentFoundLog.value = index;

				const { i } = foundLogs.value[index];
				
				pageEl?.value?.scrollTo?.({
					top: i * 20,
				});
			}

			foundLogsTotal.value = foundLogs.value.length;
		}

		const logsController = shallowRef(null);

		const loadLogs = async () => {
			logsController.value?.abort?.();
			
			loading.value = true;
			scroll.value = 0;
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

			loading.value = false;
		};

		const onWindowResize = () => {
			viewportHeight.value = window.innerHeight;
		}

		onActivated(() => {
			loadLogs();
			onWindowResize();

			window.addEventListener('resize', onWindowResize);
		});

		onDeactivated(() => {
			logsController.value?.abort?.();
			logs.value = [];

			window.removeEventListener('resize', onWindowResize);
		});

		return { loading, scroll, viewportHeight, logs, search, foundLogs, visibleLogs, currentFoundLog, foundLogsTotal, navigateSearchResults };
	},
	template: `
		<div
			ref="page"
			class="${ style.page }"
			@scroll="scroll = $event.target.scrollTop">
			<div class="${ style.search }">
				<label class="${ style.searchbar } liquid-glass">
					<Icon
						class="${ style.searchIcon }"
						icon="fa7-solid:search" />
					
					<input
						type="text"
						v-model="search"
						@input="navigateSearchResults()">

					<template v-if="!!foundLogs.length">
						<div class="${ style.searchQty }">{{ currentFoundLog + 1 }} из {{ foundLogsTotal }}</div>

						<Icon
							class="${ style.searchNavBtn }"
							icon="fa7-solid:chevron-down"
							@click.prevent="navigateSearchResults(currentFoundLog + 1)" />

						<Icon
							class="${ style.searchNavBtn }"
							icon="fa7-solid:chevron-up"
							@click.prevent="navigateSearchResults(currentFoundLog - 1)" />
					</template>
				</label>
			</div>

			<div :style="{ 'height': (20 * logs.length + 200) + 'px' }"></div>

			<template v-for="{ i, styledLog } in visibleLogs">
				<div
					class="${ style.log }"
					:class="{ 'focus': i == foundLogs?.[currentFoundLog]?.i }"
					:style="{ '--top': ( 20 * i ) + 'px' }"
					v-html="styledLog">
				</div>
			</template>
		</div>

		<Loader v-if="loading" />
	`,
	components: {
		Icon,
		Loader,
	},
}