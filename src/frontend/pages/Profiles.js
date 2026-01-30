import { ref, shallowRef, computed, watch, onMounted } from 'vue'
import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

import ketchup from '../utils/ketchup'

import Default from '../layouts/Default'

import ToggleSwitch from 'primevue/toggleswitch'
import InputText from 'primevue/inputtext'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import FloatLabel from 'primevue/floatlabel'
import Button from 'primevue/button'
import Listbox from 'primevue/listbox'
import OrderList from 'primevue/orderlist'
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

		const profiles = ref([]);
		const reordering = ref(false);

		const selectedProfileName = ref(null);

		const selectedProfile = computed(() => (
			profiles.value
				.find(({ name }) => name === selectedProfileName.value)
		));

		const createForm = () => ({
			name: '',
			active: true,
			syncUrl: '',
			content: '',
		})

		const form = ref(createForm());

		const editorOptions = computed(() => ({
			language: 'shell',
			readOnly: !!form.value.syncUrl,
		}));

		const profileNameIsValid = computed(() => (
			form.value.name.match(/^(\w|\-)+$/i)
			&&
			!profiles.value.find(({ name }) => (
				name == form.value.name
				&&
				name != selectedProfileName.value
			))
		));

		const syncUrlIsValid = computed(() => (
			(/^http(s|):\/\//).test(form.value.syncUrl)
		));

		const canSave = computed(() => (
			( form.value.name && profileNameIsValid.value )
			&&
			( !form.value.syncUrl || syncUrlIsValid.value )
		));

		const clearForm = () => {
			form.value = createForm();
		}

		const loadProfiles = async () => {
			pageLoading.value = true;

			profiles.value = await ketchup('/api/profiles');

			pageLoading.value = false;
		}

		const contentController = shallowRef(null);

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
			catch(e){}

			editorLoading.value = false;
		}

		const sync = async () => {
			pageLoading.value = true;
			
			await ketchup(`/api/profiles`, {
				method: 'PUT',
				body: JSON.stringify(profiles.value),
			});

			await ketchup('/api/antidpi/restart', {
				method: 'POST',
			});

			await loadProfiles();

			pageLoading.value = false;
		}

		const save = async () => {
			if( !canSave.value )
				return;

			const index = profiles.value
				.findIndex(({ name }) => name === selectedProfileName.value);

			if( index === -1 ){
				profiles.value
					.push({ ...form.value });
			}else{
				profiles.value
					.splice(index, 1, {
						...form.value,
						active: profiles.value[index].active,
					});
			}

			selectedProfileName.value = form.value.name;

			await sync();
		}

		const removeProfile = async name => {
			selectedProfileName.value = null;

			const index = profiles.value
				.findIndex(profile => name === profile.name);

			if( index > -1 )
				profiles.value
					.splice(index, 1);
			
			await sync();
		}

		watch(
			() => selectedProfileName.value,
			async () => {
				clearForm();

				if( !!selectedProfileName.value ){
					mobileView.value = true;

					form.value = {
						...selectedProfile.value,
					};
				}
			},
		);

		onMounted(async () => {
			await loadProfiles();
		});

		return {
			pageLoading,
			editorLoading,
			mobileView,
			profiles,
			reordering,
			selectedProfileName,
			selectedProfile,
			form,
			editorOptions,
			profileNameIsValid,
			syncUrlIsValid,
			canSave,
			clearForm,
			loadProfiles,
			syncContent,
			sync,
			save,
			removeProfile,
		};
	},
	template: `
		<Default
			header="Профили"
			v-model:mobile-view="mobileView"
			:loading="pageLoading"
			@back="selectedProfileName = null">

			<template #sidebar>
				<template v-if="reordering">
					<Button
						@click="() => {
							reordering = false;
							sync();	
						}"
						raised>
						<Icon icon="material-symbols:check-rounded" width="20" />
						<span>Готово</span>
					</Button>

					<OrderList
						class="${ style.list }"
						v-model="profiles"
						data-key="name">
						<template #option="{ option }">
							<div class="${ style.listItem }">
								<span class="${ style.listItemName }">{{ option.name }}</span>
							</div>
						</template>
					</OrderList>
				</template>

				<template v-else>
					<Button
						@click="
							selectedProfileName = null;
							mobileView = true;
							clearForm();
						"
						raised>
						<Icon icon="material-symbols:add-circle-outline-rounded" width="20" />
						<span>Новый профиль</span>
					</Button>

					<Button
						v-if="profiles.length > 1"
						@click="reordering = true"
						variant="text"
						raised>
						<Icon icon="material-symbols:compare-arrows-rounded" width="20" rotate="90deg" />
						<span>Изменить порядок</span>
					</Button>

					<Listbox
						class="${ style.list }"
						v-model="selectedProfileName"
						:options="profiles"
						optionValue="name">
						<template #option="{ option }">
							<div class="${ style.listItem }">
								<span class="${ style.listItemName }">{{ option.name }}</span>

								<div class="${ style.listItemSpace }"></div>

								<ToggleSwitch
									class="${ style.listItemSwitch }"
									v-model="option.active"
									@click.stop
									@update:model-value="sync()" />

								<Button
									class="${ style.listItemRemoveBtn }"
									variant="text"
									@click.stop="
										$confirm.require({
											group: 'remove-profile',
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
											accept: () => removeProfile(option.name),
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
			</template>

			<div class="${ style.form }">
				<template v-if="!reordering">
					<FloatLabel variant="in">
						<label class="${ style.label }">Название</label>
						<InputText
							class="${ style.input }"
							:class="{ '${ style.inputInvalid }': !!form.name && !profileNameIsValid }"
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
				</template>
			</div>

			<Butn
				class="${ style.saveBtn }"
				@click="save()"
				:disabled="pageLoading || editorLoading || !canSave">
				<Icon icon="material-symbols:save" width="20" />
				<b>Сохранить</b>
			</Butn>

			<ConfirmDialog group="remove-profile">
				<template #message="{ message }">
					<span>Вы уверены что хотите удалить профиль <b>{{ message.message }}</b>?</span>
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
		OrderList,
		ConfirmDialog,

		Monaco,
		Butn,
	},
}