import { ref, onActivated } from 'vue'
import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

import ketchup from '../utils/ketchup'

import ToggleSwitch from 'primevue/toggleswitch'

import logo from '../assets/logo.png'

const style = {
	page: css`
		display: flex;
		flex-direction: column;
		width: 100dvw;
		min-height: 100dvh;
	`,

	header: css`
		padding: 30px;
		display: flex;
		gap: 15px;
		align-items: center;
		font-size: 22px;
	`,

	body: css`
		padding-bottom: 100px;
		display: flex;
		flex: 1 1 auto;
	`,

	switch: css`
		margin: auto;
		transform: scale(3);
	`,
}

export default {
	setup()
	{
		const loading = ref(false);
		const isActive = ref(false);

		const loadState = async () => {
			loading.value = true;

			isActive.value = await ketchup('/api/antidpi');

			loading.value = false;
		}

		const onToggle = async () => {
			loading.value = true;

			await ketchup('/api/antidpi', {
				method: 'PUT',
				json: isActive.value,
			});
			
			await loadState();

			loading.value = false;
		}

		onActivated(() => {
			loadState();
		})

		return {
			loading,
			isActive,
			loadState,
			onToggle,
		};
	},
	template: `
		<div class="${ style.page }">
			<div class="${ style.header }">
				<img src="${ logo }" width="30" />
				<span>BunUnBan</span>
			</div>

			<div class="${ style.body }">
				<ToggleSwitch
					class="${ style.switch }"
					v-model="isActive"
					:readonly="loading"
					@update:model-value="onToggle()">
					<template #handle>
						<Icon
							v-if="loading"
							icon="svg-spinners:270-ring-with-bg" />
					</template>
				</ToggleSwitch>
			</div>
		</div>
	`,
	components: {
		Icon,
		ToggleSwitch,
	},
}