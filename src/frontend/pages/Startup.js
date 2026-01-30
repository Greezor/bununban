import { ref, computed } from 'vue'
import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

import ketchup from '../utils/ketchup'

import Monaco from '../components/Monaco'
import Loader from '../components/Loader'
import Butn from '../components/Butn'

const style = {
	page: css`
		display: flex;
		width: 100dvw;
		height: 100dvh;
		overflow: hidden;
		background: #1e1e1e;
		color: #d4d4d4;

		@media (max-width: 600px){
			flex-direction: column;
		}
	`,

	editorWrapper: css`
		flex: 0 0 50%;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
	`,

	editorHeader: css`
		padding: 20px;
		font-size: 20px;
	`,

	editor: css`
		flex: 1 1 100%;
	`,

	saveBtn: css`
		position: fixed;
		bottom: 98px;
		left: 50%;
		transform: translateX(-50%);
		transition: all 0.3s ease;
		color: #222;
		box-shadow: var(--liquid-shadow), var(--liquid-inner-shadow), 0 0 0 0px #ffcd19;
		z-index: 10;

		&:hover{
			--main-color: #ffcd19;
			color: #000;
			box-shadow: var(--liquid-shadow), var(--liquid-inner-shadow), 0 0 0 2px #ffcd19;
		}

		&[disabled]{
			transform: translate(-50%, 200px);
		}
	`,
}

export default {
	setup()
	{
		const loading = ref(false);

		const firewallOn = ref('');
		const firewallOff = ref('');

		const loadFirewall = async () => {
			loading.value = true;

			const { before, after } = await ketchup('/api/startup');
			firewallOn.value = before;
			firewallOff.value = after;

			loading.value = false;
		}

		loadFirewall();

		const editorOptions = computed(() => ({
			language: 'shell',
		}));

		const save = async () => {
			loading.value = true;

			await ketchup('/api/startup', {
				method: 'PUT',
				json: {
					before: firewallOn.value,
					after: firewallOff.value,
				},
			});

			await ketchup('/api/antidpi/restart', {
				method: 'POST',
			});

			await loadFirewall();

			loading.value = false;
		}

		return {
			loading,

			firewallOn,
			firewallOff,

			editorOptions,

			loadFirewall,
			save,
		};
	},
	template: `
		<div class="${ style.page }">
			<div class="${ style.editorWrapper }">
				<div class="${ style.editorHeader }">Скрипт перед включением</div>
				<Monaco
					class="${ style.editor }"
					v-model="firewallOn"
					:options="editorOptions" />
			</div>

			<div class="${ style.editorWrapper }">
				<div class="${ style.editorHeader }">Скрипт после выключения</div>
				<Monaco
					class="${ style.editor }"
					v-model="firewallOff"
					:options="editorOptions" />
			</div>

			<Butn
				class="${ style.saveBtn }"
				@click="save()">
				<Icon icon="material-symbols:save" width="20" />
				<b>Сохранить</b>
			</Butn>

			<Loader v-if="loading" />
		</div>
	`,
	components: {
		Icon,
		Monaco,
		Loader,
		Butn,
	},
}