import { ref, computed, onActivated } from 'vue'
import { css } from '@emotion/css'
import Icon from '../components/Icon'

import ketchup from '../../common/utils/ketchup'

import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Fieldset from 'primevue/fieldset'
import FloatLabel from 'primevue/floatlabel'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
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

		small{
			font-size: 70%;
		}

		&.disabled{
			opacity: 0.3;
			pointer-events: none;
		}
	`,

	settingsRowActions: css`
		margin-left: 5px;
		display: flex;
		gap: 5px;
		justify-content: end;
		align-items: center;
		min-width: 40px;
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
			'antidpi.active': false,
			'antidpi.debug': false,
			'antidpi.args': '',

			'dns.active': false,
			'dns.nameserver': '',
			'dns.doh': false,
			'dns.doh-url': '',
			'dns.hosts': [],
			'dns.hosts-mem': 0,
			'dns.hosts-ttl': 0,

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
		const listFiles = ref([])

		const bununbanVersion = computed(() => {
			return packageJSON.version;
		});

		const hostsFiles = computed(() => {
			return [
				...new Set([
					...params.value['dns.hosts'],
					...listFiles.value.map(({ name }) => name),
				]),
			].map(name => ({ filename: name }));
		});

		const loadAntidpiVersions = async () => {
			antidpiVersions.value = [];
			antidpiVersions.value = await ketchup('/api/settings/antidpi/zapret2/versions');
		}

		const loadListFiles = async () => {
			listFiles.value = [];
			listFiles.value = await ketchup('/api/lists');
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
			await new Promise(resolve => setTimeout(resolve, 5000));

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

			loading.value = false;
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

			loading.value = false;
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

			loading.value = false;
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

			loading.value = false;
		}

		const logout = async () => {
			await fetch('/api/auth/logout');
			location.href = '/login';
		}

		onActivated(() => {
			loadParams();
			loadListFiles();
		});

		return {
			accordion,
			loading,
			params,
			antidpiModal,
			antidpiVersion,
			antidpiVersions,
			listFiles,
			bununbanVersion,
			hostsFiles,
			loadParams,
			loadAntidpiVersions,
			loadListFiles,
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
									
									<div class="${ style.settingsRowActions }">
										<Button
											severity="secondary"
											rounded>
											{{ params['antidpi.version'] || '—' }}
										</Button>

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
								
								<div class="${ style.settingsRow }">
									<span>Дебаг-логи</span>

									<div class="${ style.settingsRowActions }">
										<ToggleSwitch
											v-model="params['antidpi.debug']" />
									</div>
								</div>

								<div class="${ style.settingsRow }">
									<FloatLabel variant="in">
										<InputText
											v-model="params['antidpi.args']"
											fluid />

										<label>Параметры запуска</label>
									</FloatLabel>
								</div>
							</div>
						</AccordionContent>
					</AccordionPanel>



					<AccordionPanel value="2">
						<AccordionHeader>
							<div class="${ style.settingsTitle }">
								<Icon icon="fa7-solid:globe" />
								<span>DNS-прокси</span>
							</div>
						</AccordionHeader>
						<AccordionContent>
							<div class="${ style.settingsList }">
								<div class="${ style.settingsRow }">
									<span>Включить DNS-прокси</span>

									<div class="${ style.settingsRowActions }">
										<ToggleSwitch
											v-model="params['dns.active']" />
									</div>
								</div>

								<div class="${ style.settingsRow }" :class="{ 'disabled': !params['dns.active'] }">
									<span>IP-адрес целевого DNS-сервера</span>

									<div class="${ style.settingsRowActions }">
										<Select
											v-model="params['dns.nameserver']"
											option-label="ip"
											option-value="ip"
											:options="[
												{ name: 'Google — 8.8.8.8', ip: '8.8.8.8' },
												{ name: 'Cloudflare — 1.1.1.1', ip: '1.1.1.1' },
												{ name: 'AdGuard — 94.140.14.14', ip: '94.140.14.14' },
												{ name: 'AdGuard Unfiltered — 94.140.14.140', ip: '94.140.14.140' },
												{ name: 'AdGuard Family — 94.140.14.15', ip: '94.140.14.15' },
												{ name: 'Malw.link — 84.21.189.133', ip: '84.21.189.133' },
												{ name: 'XBox DNS — 111.88.96.50', ip: '111.88.96.50' },
												{ name: 'Control D Unfiltered — 76.76.2.0', ip: '76.76.2.0' },
												{ name: 'Control D Malware — 76.76.2.1', ip: '76.76.2.1' },
												{ name: 'Control D Ads — 76.76.2.2', ip: '76.76.2.2' },
												{ name: 'Control D Social — 76.76.2.3', ip: '76.76.2.3' },
												{ name: 'Control D Family — 76.76.2.4', ip: '76.76.2.4' },
												{ name: 'Control D Advanced — 76.76.2.5', ip: '76.76.2.5' },
											]"
											placeholder="8.8.8.8"
											editable
											fluid
											style="width:200px">
											<template #option="{ option }">
												{{ option.name }}
											</template>
										</Select>
									</div>
								</div>

								<Fieldset
									legend="DNS over HTTPS"
									style="margin: 0 -18px">
									<div class="${ style.settingsList }">
										<div class="${ style.settingsRow }" :class="{ 'disabled': !params['dns.active'] }">
											<span>Использовать DoH</span>

											<div class="${ style.settingsRowActions }">
												<ToggleSwitch
													v-model="params['dns.doh']" />
											</div>
										</div>

										<div class="${ style.settingsRow }" :class="{ 'disabled': !params['dns.active'] || !params['dns.doh'] }">
											<FloatLabel variant="in">
												<Select
													v-model="params['dns.doh-url']"
													option-label="url"
													option-value="url"
													:options="[
														{ name: 'Google — dns.google', url: 'https://dns.google/dns-query' },
														{ name: 'Cloudflare — one.one.one.one', url: 'https://one.one.one.one/dns-query' },
														{ name: 'Cloudflare — cloudflare-dns.com', url: 'https://cloudflare-dns.com/dns-query' },
														{ name: 'AdGuard — dns.adguard-dns.com', url: 'https://dns.adguard-dns.com/dns-query' },
														{ name: 'AdGuard Unfiltered — unfiltered.adguard-dns.com', url: 'https://unfiltered.adguard-dns.com/dns-query' },
														{ name: 'AdGuard Family — family.adguard-dns.com', url: 'https://family.adguard-dns.com/dns-query' },
														{ name: 'Malw.link — dns.malw.link', url: 'https://dns.malw.link/dns-query' },
														{ name: 'XBox DNS — xbox-dns.ru', url: 'https://xbox-dns.ru/dns-query' },
														{ name: 'Control D Unfiltered — freedns.controld.com', url: 'https://freedns.controld.com/p0' },
														{ name: 'Control D Malware — freedns.controld.com', url: 'https://freedns.controld.com/p1' },
														{ name: 'Control D Ads — freedns.controld.com', url: 'https://freedns.controld.com/p2' },
														{ name: 'Control D Social — freedns.controld.com', url: 'https://freedns.controld.com/p3' },
														{ name: 'Control D Family — freedns.controld.com', url: 'https://freedns.controld.com/family' },
														{ name: 'Control D Advanced — freedns.controld.com', url: 'https://freedns.controld.com/uncensored' },
													]"
													placeholder="https://dns.google/dns-query"
													editable
													fluid>
													<template #option="{ option }">
														{{ option.name }}
													</template>
												</Select>

												<label>URL-адрес DoH-сервера</label>
											</FloatLabel>
										</div>
									</div>
								</Fieldset>

								<Fieldset
									legend="Хост-маппинг"
									style="margin: 0 -18px">
									<div class="${ style.settingsList }">
										<div class="${ style.settingsRow }" :class="{ 'disabled': !params['dns.active'] }">
											<FloatLabel
												class="${ css`
													width: 100%;
												` }"
												variant="in">
												<MultiSelect
													class="${ css`
														.p-multiselect-label{
															flex-wrap: wrap;
														}
													` }"
													v-model="params['dns.hosts']"
													option-label="filename"
													option-value="filename"
													:options="hostsFiles"
													:loading="!listFiles.length"
													:show-toggle-all="false"
													display="chip"
													filter
													fluid>
													<template #emptyfilter>
														Нет совпадений
													</template>
												</MultiSelect>

												<label>Файлы Hosts</label>
											</FloatLabel>
										</div>

										<div class="${ style.settingsRow }" :class="{ 'disabled': !params['dns.active'] }">
											<span>Хост-ip mem-кэш</span>

											<div class="${ style.settingsRowActions }">
												<InputNumber
													v-model="params['dns.hosts-mem']"
													placeholder="500"
													fluid />
											</div>
										</div>

										<div class="${ style.settingsRow }" :class="{ 'disabled': !params['dns.active'] }">
											<span>TTL</span>

											<div class="${ style.settingsRowActions }">
												<InputNumber
													v-model="params['dns.hosts-ttl']"
													placeholder="0"
													fluid />
											</div>
										</div>
									</div>
								</Fieldset>
							</div>
						</AccordionContent>
					</AccordionPanel>



					<AccordionPanel value="3">
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

									<div class="${ style.settingsRowActions }">
										<InputText
											v-model="params['hostname']"
											fluid />
									</div>
								</div>

								<div class="${ style.settingsRow }">
									<span>Порт</span>

									<div class="${ style.settingsRowActions }">
										<InputNumber
											v-model="params['port']"
											:format="false"
											:min="8000"
											:max="65535"
											fluid />
									</div>
								</div>

								<div class="${ style.settingsRow }">
									<span>Пароль</span>

									<div class="${ style.settingsRowActions }">
										<InputText
											v-model="params['password']"
											placeholder="••••••"
											fluid />
									</div>
								</div>

								<div class="${ style.settingsRow }">
									<span>Сбросить пароль</span>

									<div class="${ style.settingsRowActions }">
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
								</div>

								<div class="${ style.settingsRow }">
									<span>Завершить текущую сессию</span>

									<div class="${ style.settingsRowActions }">
										<Button
											raised
											@click="logout()">
											<span>Выход</span>
										</Button>
									</div>
								</div>
							</div>
						</AccordionContent>
					</AccordionPanel>



					<AccordionPanel value="4">
						<AccordionHeader>
							<div class="${ style.settingsTitle }">
								<Icon icon="fa7-solid:sync" />
								<span>Обновление</span>
							</div>
						</AccordionHeader>
						<AccordionContent>
							<div class="${ style.settingsList }">
								<div class="${ style.settingsRow }">
									<span>Обновлять Bununban</span>

									<div class="${ style.settingsRowActions }">
										<ToggleSwitch
											v-model="params['updater.self']" />
									</div>
								</div>

								<div class="${ style.settingsRow }" :class="{ 'disabled': !params['updater.self'] }">
									<div>
										<Icon icon="material-symbols:subdirectory-arrow-right-rounded" style="margin-right:10px" />
										<span>Добавлять новые ресурсы</span>
									</div>

									<div class="${ style.settingsRowActions }">
										<ToggleSwitch
											v-model="params['updater.new-resources']" />
									</div>
								</div>

								<div class="${ style.settingsRow }">
									<span>Обновлять Zapret2</span>

									<div class="${ style.settingsRowActions }">
										<ToggleSwitch
											v-model="params['updater.zapret2']" />
									</div>
								</div>

								<Fieldset
									legend="Синхронизация ресурсов по ссылке"
									style="margin: 0 -18px">
									<div class="${ style.settingsList }">
										<div class="${ style.settingsRow }">
											<span>Синхронизировать профили</span>

											<div class="${ style.settingsRowActions }">
												<ToggleSwitch
													v-model="params['updater.profiles']" />
											</div>
										</div>

										<div class="${ style.settingsRow }">
											<span>Синхронизировать файлы и списки</span>

											<div class="${ style.settingsRowActions }">
												<ToggleSwitch
													v-model="params['updater.lists']" />
											</div>
										</div>

										<div class="${ style.settingsRow }">
											<span>Синхронизировать lua-скрипты</span>

											<div class="${ style.settingsRowActions }">
												<ToggleSwitch
													v-model="params['updater.lua']" />
											</div>
										</div>

										<div class="${ style.settingsRow }">
											<span>Синхронизировать blob'ы</span>

											<div class="${ style.settingsRowActions }">
												<ToggleSwitch
													v-model="params['updater.blobs']" />
											</div>
										</div>
									</div>
								</Fieldset>

								<Fieldset
									legend="Поиск и установка обновлений"
									style="margin: 0 -18px">
									<div class="${ style.settingsList }">
										<div class="${ style.settingsRow }">
											<span>При запуске</span>

											<div class="${ style.settingsRowActions }">
												<ToggleSwitch
													v-model="params['updater.on-startup']" />
											</div>
										</div>

										<div class="${ style.settingsRow }">
											<span>Интервал</span>

											<div class="${ style.settingsRowActions }">
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
													]"
													fluid />
											</div>
										</div>

										<div class="${ style.settingsRow }">
											<span></span>

											<div class="${ style.settingsRowActions }">
												<Button
													raised
													@click="updateNow()">
													<span>Обновить сейчас</span>
												</Button>
											</div>
										</div>
									</div>
								</Fieldset>
							</div>
						</AccordionContent>
					</AccordionPanel>



					<AccordionPanel value="5">
						<AccordionHeader>
							<div class="${ style.settingsTitle }">
								<Icon icon="fa7-solid:fire" />
								<span>Сброс</span>
							</div>
						</AccordionHeader>
						<AccordionContent>
							<div class="${ style.settingsList }">
								<div class="${ style.settingsRow }">
									<span>Сбросить настройки</span>

									<div class="${ style.settingsRowActions }">
										<Button
											raised
											severity="danger"
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
							</div>
						</AccordionContent>
					</AccordionPanel>



					<AccordionPanel value="6">
						<AccordionHeader>
							<div class="${ style.settingsTitle }">
								<Icon icon="fa7-solid:circle-info" />
								<span>Информация</span>
							</div>
						</AccordionHeader>
						<AccordionContent>
							<div class="${ style.settingsList }">
								<div class="${ style.settingsRow }">
									<span>Версия Bununban</span>

									<div class="${ style.settingsRowActions }">
										<Button
											severity="secondary"
											rounded>
											{{ bununbanVersion }}
										</Button>
									</div>
								</div>

								<div class="${ style.settingsRow }">
									<span>Github</span>

									<div class="${ style.settingsRowActions }">
										<Button
											severity="contrast"
											variant="text"
											size="small"
											as="a"
											href="https://github.com/Greezor/bununban"
											target="_blank">
											<Icon icon="fa7-brands:github" width="22" />
										</Button>
									</div>
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
		FloatLabel,
		InputText,
		InputNumber,
		ToggleSwitch,
		Select,
		MultiSelect,
		Button,
		Dialog,
		ConfirmDialog,

		Loader,
		Butn,
	},
}