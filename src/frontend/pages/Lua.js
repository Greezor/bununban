import { ref, shallowRef, computed, watch, onActivated } from 'vue'
import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

import ketchup from '../../common/utils/ketchup'

import Default from '../layouts/Default'

import ToggleSwitch from 'primevue/toggleswitch'
import InputText from 'primevue/inputtext'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import FloatLabel from 'primevue/floatlabel'
import Button from 'primevue/button'
import Listbox from 'primevue/listbox'
import ConfirmDialog from 'primevue/confirmdialog'

import Monaco from '../components/Monaco'
import Butn from '../components/Butn'

const style = {
	list: css`
		position: relative!important;
		flex: 1 1 auto!important;

		.p-listbox{
			position: relative;
		}

		.p-listbox-list-container{
			position: absolute!important;
			padding-bottom: 78px!important;
			width: 100%!important;
			height: 100%!important;
			max-height: 100%!important;
		}
	`,

	listItem: css`
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		color: #222;
	`,

	listItemName: css`
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	`,

	listItemSpace: css`
		flex: 1 1 auto;
	`,

	listItemSwitch: css`
		flex: 0 0 40px;
	`,

	listItemRemoveBtn: css`
		margin: -10px -12px -10px 0;
		padding: 8px!important;
		flex: 0 0 38px;
		background: transparent!important;
		color: #222!important;
	`,

	form: css`
		flex: 1 1 100%;
		display: flex;
		flex-direction: column;
		background: #1e1e1e;
		color: #d4d4d4;
	`,

	input: css`
		background: transparent!important;
		border-radius: 0!important;
		border-color: #333!important;
		border-width: 0 0 1px 0!important;
		color: currentColor!important;
	`,

	inputInvalid: css`
		color: #ff5555!important;
	`,

	label: css`
		color: #949494!important;
	`,

	editor: css`
		flex: 1 1 100%;
	`,

	editorDisabled: css`
		opacity: 0.3;
	`,

	saveBtn: css`
		position: absolute;
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
		const pageLoading = ref(false);
		const editorLoading = ref(false);

		const mobileView = ref(false);

		const files = ref([]);

		const selectedFileName = ref(null);

		const selectedFile = computed(() => (
			files.value
				.find(({ name }) => name === selectedFileName.value)
		));

		const createForm = () => ({
			name: '',
			active: true,
			syncUrl: '',
			content: '',
		})

		const form = ref(createForm());

		const editorOptions = computed(() => ({
			language: 'lua',
			readOnly: !!form.value.syncUrl,
		}));

		const filenameIsValid = computed(() => (
			form.value.name.match(/^(\w|\-)+$/i)
			&&
			!files.value.find(({ name }) => (
				name == form.value.name
				&&
				name != selectedFileName.value
			))
		));

		const syncUrlIsValid = computed(() => (
			(/^http(s|):\/\//).test(form.value.syncUrl)
		));

		const canSave = computed(() => (
			( form.value.name && filenameIsValid.value )
			&&
			( !form.value.syncUrl || syncUrlIsValid.value )
		));

		const clearForm = () => {
			form.value = createForm();
		}

		const loadFiles = async () => {
			pageLoading.value = true;

			files.value = await ketchup('/api/lua');

			pageLoading.value = false;
		}

		const contentController = shallowRef(null);

		const loadContent = async () => {
			contentController.value?.abort?.();

			contentController.value = new AbortController();
			editorLoading.value = true;

			const fileData = await ketchup(`/api/lua/${ selectedFileName.value }`, {
				signal: contentController.signal,
			});

			form.value.content = fileData?.content ?? '';

			editorLoading.value = false;
		}

		const syncContent = async () => {
			if( !syncUrlIsValid.value )
				return;

			contentController.value?.abort?.();

			contentController.value = new AbortController();
			editorLoading.value = true;

			try{
				form.value.content = await ketchup.text('/api/cors-hole', {
					retry: false,
					signal: contentController.signal,
					method: 'POST',
					json: {
						url: form.value.syncUrl,
					},
				});
			}
			catch(e){
				console.error(e)
			}

			editorLoading.value = false;
		}

		const restartAntidpi = async () => {
			await ketchup('/api/antidpi/restart', {
				method: 'POST',
			});
		}

		const updateItem = async (name, form) => {
			const file = files.value
				.find(item => item.name === name);

			await ketchup(`/api/lua/${ name }`, {
				method: 'PUT',
				json: {
					...form,
					active: file.active,
				},
			});

			await restartAntidpi();
		}

		const save = async () => {
			if( !canSave.value )
				return;

			pageLoading.value = true;
			
			await updateItem(selectedFileName.value ?? form.value.name, form.value);

			await loadFiles();
			selectedFileName.value = form.value.name;
			await loadContent();

			pageLoading.value = false;
		}

		const removeFile = async name => {
			pageLoading.value = true;
			selectedFileName.value = null;

			await ketchup(`/api/lua/${ name }`, {
				method: 'DELETE',
			});

			await restartAntidpi();
			
			await loadFiles();

			pageLoading.value = false;
		}

		watch(
			() => selectedFileName.value,
			async () => {
				contentController.value?.abort?.();
				editorLoading.value = false;

				clearForm();

				if( !!selectedFileName.value ){
					mobileView.value = true;

					form.value = {
						...selectedFile.value,
						content: '',
					};

					await loadContent();
				}
			},
		);

		onActivated(async () => {
			await loadFiles();
		});

		return {
			pageLoading,
			editorLoading,
			mobileView,
			files,
			selectedFileName,
			selectedFile,
			form,
			editorOptions,
			filenameIsValid,
			syncUrlIsValid,
			canSave,
			clearForm,
			loadFiles,
			loadContent,
			syncContent,
			updateItem,
			save,
			removeFile,
		};
	},
	template: `
		<Default
			header="Lua-код"
			v-model:mobile-view="mobileView"
			:loading="pageLoading"
			@back="selectedFileName = null">

			<template #sidebar>
				<Button
					@click="
						selectedFileName = null;
						mobileView = true;
						clearForm();
					"
					raised>
					<Icon icon="material-symbols:add-circle-outline-rounded" width="20" />
					<span>Новый lua-файл</span>
				</Button>

				<Listbox
					class="${ style.list }"
					v-model="selectedFileName"
					:options="files"
					optionValue="name">
					<template #option="{ option }">
						<div class="${ style.listItem }">
							<span class="${ style.listItemName }">{{ option.name }}</span>

							<div class="${ style.listItemSpace }"></div>

							<ToggleSwitch
								class="${ style.listItemSwitch }"
								v-model="option.active"
								@click.stop
								@update:model-value="async () => {
									pageLoading = true;

									await updateItem(option.name, option);
									await loadContent();
									
									pageLoading = false;
								}" />

							<Button
								class="${ style.listItemRemoveBtn }"
								variant="text"
								@click.stop="
									$confirm.require({
										group: 'remove-lua',
										header: 'Вы уверены?',
										message: option.name,
										acceptLabel: 'Да',
										rejectLabel: 'Нет',
										acceptProps: {
											severity: 'danger',
										},
										rejectProps: {
											severity: 'secondary',
											variant: 'outlined',
										},
										accept: () => removeFile(option.name),
									})
								">
								<Icon icon="material-symbols:close-rounded" width="20" />
							</Button>
						</div>
					</template>

					<template #empty>
						<div>Пусто</div>
					</template>
				</Listbox>
			</template>

			<div class="${ style.form }">
				<FloatLabel variant="in">
					<label class="${ style.label }">Название</label>
					<InputText
						class="${ style.input }"
						:class="{ '${ style.inputInvalid }': !!form.name && !filenameIsValid }"
						v-model="form.name"
						fluid />
				</FloatLabel>

				<FloatLabel variant="in">
					<label class="${ style.label }">URL для синхронизации</label>
					<InputGroup>
						<InputText
							class="${ style.input }"
							:class="{ '${ style.inputInvalid }': !!form.syncUrl && !syncUrlIsValid }"
							v-model="form.syncUrl"
							fluid />

						<InputGroupAddon class="${ style.input }">
							<Button
								v-if="syncUrlIsValid"
								variant="link"
								@click="syncContent()">
								<Icon icon="material-symbols:refresh-rounded" width="20" />
							</Button>
						</InputGroupAddon>
					</InputGroup>
				</FloatLabel>

				<Monaco
					class="${ style.editor }"
					:class="{ '${ style.editorDisabled }': !!form.syncUrl }"
					v-model="form.content"
					:options="editorOptions"
					:loading="editorLoading" />
			</div>

			<Butn
				class="${ style.saveBtn }"
				@click="save()"
				:disabled="pageLoading || editorLoading || !canSave">
				<Icon icon="material-symbols:save" width="20" />
				<b>Сохранить</b>
			</Butn>

			<ConfirmDialog group="remove-lua">
				<template #message="{ message }">
					<span>Вы уверены что хотите удалить файл <b>{{ message.message }}</b>?</span>
				</template>
			</ConfirmDialog>
			
		</Default>
	`,
	components: {
		Default,

		Icon,
		ToggleSwitch,
		InputText,
		InputGroup,
		InputGroupAddon,
		FloatLabel,
		Button,
		Listbox,
		ConfirmDialog,

		Monaco,
		Butn,
	},
}