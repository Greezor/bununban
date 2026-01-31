import { ref, computed, onActivated } from 'vue'
import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

import ketchup from '../../common/utils/ketchup'

import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ConfirmDialog from 'primevue/confirmdialog'

import Loader from '../components/Loader'
import Butn from '../components/Butn'

import packageJSON from '../../../package.json'

const style = {
	page: css`
		padding: 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		width: 100dvw;
		height: 100dvh;
		overflow-x: hidden;
		overflow-y: auto;
	`,

	header: css`
		width: 100%;
		font-size: 20px;
	`,

	body: css`
		margin-bottom: 150px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		max-width: 600px;
		flex: 1 1 auto;
	`,

	settingsTitle: css`
		margin-top: 50px;
		padding: 5px 0;
		font-size: 18px;
		border-bottom: 1px solid rgb(from currentColor r g b / 0.3);
	`,

	settingsRow: css`
		display: flex;
		justify-content: space-between;
		align-items: center;
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

		const params = ref({
			'antidpi.debug': false,
			'startup.args': '',

			'updater.self': false,
			'updater.zapret2': false,
			'updater.profiles': false,
			'updater.lists': false,
			'updater.lua': false,
			'updater.blobs': false,
			'updater.interval': 1000 * 60 * 60 * 24,

			'hostname': '0.0.0.0',
			'port': '8008',
		});

		const loadParams = async () => {
			loading.value = true;

			Object.assign(params.value, await ketchup('/api/settings'));

			loading.value = false;
		}

		const antidpiModal = ref(false);
		const antidpiVersion = ref(null);
		const antidpiVersions = ref([]);

		const bununbanVersion = computed(() => {
			return packageJSON.version;
		});

		const loadAntidpiVersions = async () => {
			antidpiVersions.value = [];
			antidpiVersions.value = await ketchup('/api/settings/antidpi/zapret2/versions');
		}

		const installAntidpi = async () => {
			if( !antidpiVersion.value )
				return;

			loading.value = true;

			await ketchup(`/api/settings/antidpi/zapret2/install/${ antidpiVersion.value }`, {
				method: 'POST',
			});

			await loadParams();

			loading.value = false;
		}

		const waitServerReload = async () => {
			await new Promise(resolve => setTimeout(resolve, 1000));

			const newOrigin = `http://${
				params.value.hostname === '0.0.0.0'
					? location.hostname
					: params.value.hostname
			}:${
				params.value.port
			}`;

			await ketchup(`${ newOrigin }/api/ping`, { retry: Infinity });

			location.href = `${ newOrigin }/settings`;
		}

		const save = async () => {
			loading.value = true;
			
			await ketchup('/api/settings', {
				method: 'PUT',
				json: params.value,
			});

			try{
				fetch('/api/server/restart', {
					method: 'POST',
				});
			}
			catch(e){
				console.error(e)
			}

			await waitServerReload();
		}

		const settingsReset = async () => {
			loading.value = true;

			params.value.hostname = '0.0.0.0';
			params.value.port = '8008';

			try{
				fetch('/api/settings/reset', {
					method: 'POST',
				});
			}
			catch(e){
				console.error(e)
			}

			await waitServerReload();
		}

		const updateNow = async () => {
			loading.value = true;

			try{
				await fetch('/api/updater/update-now', {
					method: 'POST',
				});
			}
			catch(e){
				console.error(e)
			}

			await waitServerReload();
		}

		onActivated(() => {
			loadParams();
		});

		return {
			loading,
			params,
			antidpiModal,
			antidpiVersion,
			antidpiVersions,
			bununbanVersion,
			loadParams,
			loadAntidpiVersions,
			installAntidpi,
			waitServerReload,
			save,
			settingsReset,
			updateNow,
		};
	},
	template: `
		<div class="${ style.page }">
			<div class="${ style.header }">
				<span>Настройки</span>
			</div>

			<div class="${ style.body }">
				<div class="${ style.settingsTitle }">
					<span>Anti-DPI</span>
				</div>

				<div class="${ style.settingsRow }">
					<span>Zapret2</span>
					<Button
						severity="secondary"
						rounded>
						{{ params['antidpi.version'] || '—' }}
					</Button>
				</div>

				<div class="${ style.settingsRow }">
					<span></span>
					<Button
						raised
						@click="() => {
							antidpiModal = true;
							antidpiVersion = null;
							loadAntidpiVersions();	
						}">
						<span>Установить</span>
					</Button>
				</div>



				<div class="${ style.settingsTitle }">
					<span>Запуск</span>
				</div>

				<div class="${ style.settingsRow }">
					<span>Дебаг-логи</span>
					<ToggleSwitch
						v-model="params['antidpi.debug']" />
				</div>

				<div class="${ style.settingsRow }">
					<span>Параметры запуска</span>
				</div>

				<div class="${ style.settingsRow }">
					<InputText
						v-model="params['startup.args']"
						fluid />
				</div>



				<div class="${ style.settingsTitle }">
					<span>Авто-обновление</span>
				</div>

				<div class="${ style.settingsRow }">
					<span>Обновлять Bununban</span>
					<ToggleSwitch
						v-model="params['updater.self']" />
				</div>

				<div class="${ style.settingsRow }">
					<span>Обновлять Zapret2</span>
					<ToggleSwitch
						v-model="params['updater.zapret2']" />
				</div>

				<div class="${ style.settingsRow }">
					<span>Синхронизировать профили</span>
					<ToggleSwitch
						v-model="params['updater.profiles']" />
				</div>

				<div class="${ style.settingsRow }">
					<span>Синхронизировать файлы и списки</span>
					<ToggleSwitch
						v-model="params['updater.lists']" />
				</div>

				<div class="${ style.settingsRow }">
					<span>Синхронизировать lua-скрипты</span>
					<ToggleSwitch
						v-model="params['updater.lua']" />
				</div>

				<div class="${ style.settingsRow }">
					<span>Синхронизировать blob'ы</span>
					<ToggleSwitch
						v-model="params['updater.blobs']" />
				</div>

				<div class="${ style.settingsRow }">
					<span>Интервал</span>
					<Select
						v-model="params['updater.interval']"
						option-label="label"
						option-value="value"
						:options="[
							{ label: '1 час', value: 1000 * 60 * 60 * 1 },
							{ label: '3 часа', value: 1000 * 60 * 60 * 3 },
							{ label: '12 часов', value: 1000 * 60 * 60 * 12 },
							{ label: '1 день', value: 1000 * 60 * 60 * 24 },
							{ label: '3 дня', value: 1000 * 60 * 60 * 24 * 3 },
							{ label: '7 дней', value: 1000 * 60 * 60 * 24 * 7 },
						]" />
				</div>

				<div class="${ style.settingsRow }">
					<span>Поиск и установка обновлений</span>
					<Button
						raised
						@click="updateNow()">
						<span>Обновить</span>
					</Button>
				</div>



				<div class="${ style.settingsTitle }">
					<span>Доступ</span>
				</div>

				<div class="${ style.settingsRow }">
					<span>Хост</span>
					<InputText
						v-model="params['hostname']" />
				</div>

				<div class="${ style.settingsRow }">
					<span>Порт</span>
					<InputNumber
						v-model="params['port']"
						:format="false"
						:min="8000"
						:max="65535" />
				</div>



				<div class="${ style.settingsTitle }">
					<span>Другое</span>
				</div>

				<div class="${ style.settingsRow }">
					<span>Версия Bununban</span>
					<Button
						severity="secondary"
						rounded>
						{{ bununbanVersion }}
					</Button>
				</div>

				<div class="${ style.settingsRow }">
					<span>Сбросить настройки</span>
					<Button
						raised
						@click="() => {
							$confirm.require({
								group: 'settings-reset',
								header: 'Вы уверены?',
								message: '',
								acceptLabel: 'Сброс',
								rejectLabel: 'Отмена',
								acceptProps: {
									severity: 'danger',
								},
								rejectProps: {
									severity: 'secondary',
									variant: 'outlined',
								},
								accept: () => settingsReset(),
							})
						}">
						<span>Сброс</span>
					</Button>
				</div>
			</div>

			<Butn
				class="${ style.saveBtn }"
				@click="save()">
				<Icon icon="material-symbols:save" width="20" />
				<b>Сохранить</b>
			</Butn>

			<Dialog
				v-model:visible="antidpiModal"
				modal
				header="Zapret2">
				<Select
					v-model="antidpiVersion"
					:options="antidpiVersions"
					:loading="!antidpiVersions.length"
					placeholder="Выберите версию"
					fluid />

				<template #footer>
					<Button
						type="button"
						severity="secondary"
						variant="outlined"
						@click="() => {
							antidpiModal = false;	
						}">
						<span>Отмена</span>
					</Button>

					<Button
						type="button"
						:disabled="!antidpiVersion"
						@click="() => {
							installAntidpi();
							antidpiModal = false;	
						}">
						<span>Установить</span>
					</Button>
				</template>
			</Dialog>

			<ConfirmDialog group="settings-reset">
				<template #message="{ message }">
					<span>Вы уверены что хотите выполнить сброс всех настроек?</span>
				</template>
			</ConfirmDialog>

			<Loader v-if="loading" />
		</div>
	`,
	components: {
		Icon,

		InputText,
		InputNumber,
		ToggleSwitch,
		Select,
		Button,
		Dialog,
		ConfirmDialog,

		Loader,
		Butn,
	},
}