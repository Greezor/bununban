import { ref, computed, onActivated } from 'vue'
import { css } from '@emotion/css'
import Icon from '../components/Icon'

import ketchup from '../../common/utils/ketchup'

import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Fieldset from 'primevue/fieldset'
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
		margin: auto;
		padding-bottom: 150px;
		width: 100%;
		max-width: 600px;
	`,

	settingsList: css`
		display: flex;
		flex-direction: column;
		gap: 10px;
	`,

	settingsTitle: css`
		display: flex;
		align-items: center;
		gap: 10px;
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
		const accordion = ref([]);
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
			'updater.new-resources': false,
			'updater.interval': 0,
			'updater.on-startup': false,

			'hostname': '',
			'port': '',
			'password': '',
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

			await loadParams();
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

		const resetPassword = async () => {
			loading.value = true;

			try{
				fetch('/api/settings/reset-password', {
					method: 'POST',
				});
			}
			catch(e){
				console.error(e)
			}

			await waitServerReload();
		}

		const resetSettings = async () => {
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

		const logout = async () => {
			await fetch('/api/auth/logout');
			location.href = '/login';
		}

		onActivated(() => {
			loadParams();
		});

		return {
			accordion,
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
			resetPassword,
			resetSettings,
			updateNow,
			logout,
		};
	},
	template: `
		<div class="${ style.page }">
			<div class="${ style.header }">
				<span>Настройки</span>
			</div>

			<div class="${ style.body } ${ style.settingsList }">
				<Accordion :value="accordion" multiple>

					<AccordionPanel value="1">
						<AccordionHeader>
							<div class="${ style.settingsTitle }">
								<Icon icon="fa7-solid:shield-alt" />
								<span>Anti-DPI</span>
							</div>
						</AccordionHeader>
						<AccordionContent>
							<div class="${ style.settingsList }">
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
							</div>
						</AccordionContent>
					</AccordionPanel>



					<AccordionPanel value="2">
						<AccordionHeader>
							<div class="${ style.settingsTitle }">
								<Icon icon="fa7-solid:rocket" />
								<span>Запуск</span>
							</div>
						</AccordionHeader>
						<AccordionContent>
							<div class="${ style.settingsList }">
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
							</div>
						</AccordionContent>
					</AccordionPanel>



					<AccordionPanel value="3">
						<AccordionHeader>
							<div class="${ style.settingsTitle }">
								<Icon icon="fa7-solid:sync" />
								<span>Автообновление</span>
							</div>
						</AccordionHeader>
						<AccordionContent>
							<div class="${ style.settingsList }">
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
									<span>Добавлять новые ресурсы</span>
									<ToggleSwitch
										v-model="params['updater.new-resources']" />
								</div>

								<Fieldset
									legend="Синхронизация ресурсов по ссылке"
									style="margin: 0 -19px">
									<div class="${ style.settingsList }">
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
									</div>
								</Fieldset>

								<Fieldset
									legend="Поиск и установка обновлений"
									style="margin: 0 -19px">
									<div class="${ style.settingsList }">
										<div class="${ style.settingsRow }">
											<span>При запуске</span>
											<ToggleSwitch
												v-model="params['updater.on-startup']" />
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
											<span></span>
											<Button
												raised
												@click="updateNow()">
												<span>Выполнить сейчас</span>
											</Button>
										</div>
									</div>
								</Fieldset>
							</div>
						</AccordionContent>
					</AccordionPanel>



					<AccordionPanel value="4">
						<AccordionHeader>
							<div class="${ style.settingsTitle }">
								<Icon icon="fa7-solid:lock" />
								<span>Доступ</span>
							</div>
						</AccordionHeader>
						<AccordionContent>
							<div class="${ style.settingsList }">
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

								<div class="${ style.settingsRow }">
									<span>Пароль</span>
									<InputText
										v-model="params['password']"
										placeholder="••••••" />
								</div>

								<div class="${ style.settingsRow }">
									<span>Сбросить пароль</span>
									<Button
										raised
										@click="() => {
											$confirm.require({
												group: 'password-reset',
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
												accept: () => resetPassword(),
											})
										}">
										<span>Сброс</span>
									</Button>
								</div>

								<div class="${ style.settingsRow }">
									<span>Завершить текущую сессию</span>
									<Button
										raised
										@click="logout()">
										<span>Выход</span>
									</Button>
								</div>
							</div>
						</AccordionContent>
					</AccordionPanel>



					<AccordionPanel value="5">
						<AccordionHeader>
							<div class="${ style.settingsTitle }">
								<Icon icon="fa7-solid:bars" />
								<span>Другое</span>
							</div>
						</AccordionHeader>
						<AccordionContent>
							<div class="${ style.settingsList }">
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
												accept: () => resetSettings(),
											})
										}">
										<span>Сброс</span>
									</Button>
								</div>
							</div>
						</AccordionContent>
					</AccordionPanel>

				</Accordion>
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

			<ConfirmDialog group="password-reset">
				<template #message="{ message }">
					<span>Вы уверены что хотите сбросить текущий пароль?</span>
				</template>
			</ConfirmDialog>

			<Loader v-if="loading" />
		</div>
	`,
	components: {
		Icon,

		Accordion,
		AccordionPanel,
		AccordionHeader,
		AccordionContent,
		Fieldset,
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