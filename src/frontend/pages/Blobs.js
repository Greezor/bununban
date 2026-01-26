import { ref, useTemplateRef, computed, watch, onMounted } from 'vue'
import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

import ketchup from '../utils/ketchup'

import Default from '../layouts/Default'

import ToggleSwitch from 'primevue/toggleswitch'
import InputText from 'primevue/inputtext'
import FloatLabel from 'primevue/floatlabel'
import Button from 'primevue/button'
import Listbox from 'primevue/listbox'
import ConfirmDialog from 'primevue/confirmdialog'

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

	fileInput: css`
		padding: 16px 12px;
		border-bottom: 1px solid #333;
	`,

	fileInputDisabled: css`
		pointer-events: none;
		opacity: 0.3;
	`,

	inputInvalid: css`
		color: #ff5555!important;
	`,

	label: css`
		color: #949494!important;
	`,

	saveBtn: css`
		position: absolute;
		bottom: 98px;
		left: 50%;
		transform: translateX(-50%);
		transition: all 0.3s ease;
		color: #ffcd19;
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
		})

		const form = ref(createForm());

		const fileInput = useTemplateRef('file-input');

		const filenameIsValid = computed(() => (
			form.value.name.match(/^\w+$/i)
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
			fileInput.value.value = null;
		}

		const loadFiles = async () => {
			pageLoading.value = true;

			files.value = await ketchup('/api/blobs');

			pageLoading.value = false;
		}

		const restartAntidpi = async () => {
			await ketchup('/api/antidpi/restart', {
				method: 'POST',
			});
		}

		const updateItem = async (name, form) => {
			const file = files.value
				.find(item => item.name === name);

			await ketchup(`/api/blobs/${ name }`, {
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
			
			const name = selectedFileName.value ?? form.value.name;

			await updateItem(name, form.value);

			if( fileInput.value.files.length ){
				const formData = new FormData();
				formData.append('file', fileInput.value.value);

				await ketchup(`/api/blobs/${ name }`, {
					method: 'POST',
					body: formData,
				});
			}

			await loadFiles();
			selectedFileName.value = form.value.name;

			pageLoading.value = false;
		}

		const removeFile = async name => {
			pageLoading.value = true;
			selectedFileName.value = null;

			await ketchup(`/api/blobs/${ name }`, {
				method: 'DELETE',
			});

			await restartAntidpi();
			
			await loadFiles();

			pageLoading.value = false;
		}

		watch(
			() => selectedFileName.value,
			async () => {
				clearForm();

				if( !!selectedFileName.value ){
					mobileView.value = true;

					form.value = {
						...selectedFile.value,
					};
				}
			},
		);

		onMounted(async () => {
			await loadFiles();
		});

		return {
			pageLoading,
			mobileView,
			files,
			selectedFileName,
			selectedFile,
			form,
			filenameIsValid,
			syncUrlIsValid,
			canSave,
			clearForm,
			loadFiles,
			updateItem,
			save,
			removeFile,
		};
	},
	template: `
		<Default
			header="Blob'ы"
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
					<span>Новый blob</span>
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
									
									pageLoading = false;
								}" />

							<Button
								class="${ style.listItemRemoveBtn }"
								variant="text"
								@click.stop="
									$confirm.require({
										group: 'remove-blob',
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
					<InputText
						class="${ style.input }"
						:class="{ '${ style.inputInvalid }': !!form.syncUrl && !syncUrlIsValid }"
						v-model="form.syncUrl"
						fluid />
				</FloatLabel>

				<input
					ref="file-input"
					class="${ style.fileInput }"
					:class="{ '${ style.fileInputDisabled }': !!form.syncUrl }"
					type="file">
			</div>

			<Butn
				class="${ style.saveBtn }"
				@click="save()"
				:disabled="pageLoading || !canSave">
				<Icon icon="material-symbols:save" width="20" />
				<b>Сохранить</b>
			</Butn>

			<ConfirmDialog group="remove-blob">
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
		FloatLabel,
		Button,
		Listbox,
		ConfirmDialog,

		Butn,
	},
}