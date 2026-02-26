import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

import { APPDATA_DIR } from '../src/backend/utils/appdata'
import settings from '../src/backend/stores/settings'

import ico from '../src/frontend/assets/favicon.ico' with { type: 'file' }
import lnk from './Bununban.lnk' with { type: 'file' }
import dll from '../node_modules/@webui-dev/bun-webui/src/webui-windows-msvc-x64/webui-2.dll' with { type: 'file' }

if( process.env.NODE_ENV === 'production' )
	await Bun.write('./webui-windows-msvc-x64/webui-2.dll', await Bun.file(dll).arrayBuffer());

const { WebUI } = await import('@webui-dev/bun-webui');

const BIN_SUFFIX = process.env.NO_SIMD === '1' ? '-no-simd.exe' : '.exe';

const { default: bin } = await import(`../dist/bununban-windows-x64${ BIN_SUFFIX }`, {
	with: { type: 'file' },
});

const BIN_PATH = `C:\\bununban\\bununban-windows-x64${ BIN_SUFFIX }`;
const BIN = await Bun.file(bin).arrayBuffer();

const ICO_PATH = 'C:\\bununban\\icon.ico';
const ICO = await Bun.file(ico).arrayBuffer();

const LNK_PATH = join(homedir(), 'Desktop', 'Bununban.lnk');
const LNK = await Bun.file(lnk).arrayBuffer();

const window = new WebUI();

window.setSize(500, 250);
window.setFrameless(true);
window.setTransparent(true);
window.setResizable(false);
window.setCenter();

const isInstalled = (
	await Bun.file('C:\\bununban\\bununban-windows-x64.exe').exists()
	||
	await Bun.file('C:\\bununban\\bununban-windows-x64-no-simd.exe').exists()
);

const settingsFile = Bun.file( join(APPDATA_DIR, 'settings') );
const hasSettings = await settingsFile.exists();

const port = await settings.get('port') ?? '8008';
const hostname = await settings.get('hostname') ?? '0.0.0.0';

const sh = cmd => {
	try{
		execSync(cmd, { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true })
	}
	catch(e){}
};

window.bind('installApp', async e => {
	const clr = e.arg.boolean(0);

	if( clr )
		sh(`rmdir /s /q ${ APPDATA_DIR }`);

	sh(`mkdir C:\\bununban`);
	writeFileSync(BIN_PATH, BIN);
	writeFileSync(ICO_PATH, ICO);
	writeFileSync(LNK_PATH, LNK);
	sh(`netsh interface tcp set global timestamps=enabled`);
	sh(`schtasks /create /tn "bununban" /tr "${ BIN_PATH }" /sc onlogon /rl highest`);
	sh(`schtasks /run /tn "bununban"`);

	return hasSettings && !clr
		? `http://${ hostname == '0.0.0.0' ? 'localhost' : hostname }:${ port }`
		: `http://localhost:8008`;
});

window.bind('uninstallApp', async e => {
	const clr = e.arg.boolean(0);

	sh(`schtasks /delete /tn "bununban" /f`);
	sh(`taskkill /f /im bununban-windows-x64.exe`);
	sh(`taskkill /f /im bununban-windows-x64-no-simd.exe`);

	sh(`sc delete windivert`);
	sh(`sc stop windivert`);

	sh(`rmdir /s /q C:\\bununban`);
	sh(`del /f /q "${ LNK_PATH }"`);

	if( clr )
		sh(`rmdir /s /q ${ APPDATA_DIR }`);

	return true;
});

window.bind('openUrl', async e => {
	const url = e.arg.string(0);
	sh(`start ${ url }`);
	return true;
});

window.bind('closeSetup', async () => {
	window.close();
	WebUI.exit();
});

window.show(`
	<html>
		<head>
			<script src="webui.js"></script>
			<title>Setup</title>
			<meta charset="UTF-8">
			<style>
				*{
					margin: 0;
					padding: 0;
					box-sizing: border-box;
				}

				body{
					padding: 10px;
					display: flex;
					flex-direction: column;
					justify-content: center;
					align-items: center;
					gap: 10px;
					width: 100vw;
					height: 100vh;
					font-family: system-ui;
					font-size: 16px;
					color: #333;
					user-select: none;
					overflow: hidden;
				}

				body:before{
					content: '';
					position: fixed;
					top: 3px;
					left: 4px;
					right: 4px;
					bottom: 5px;
					background-color: #fff;
					border-radius: 5px;
					box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
					z-index: -1;
				}

				body:after{
					content: '';
					position: fixed;
					top: 3px;
					left: 4px;
					right: 4px;
					height: 50px;
					app-region: drag;
				}

				h1{
					margin: 0;
					font-size: 24px;
					font-weight: 200;
				}

				.icon{
					display: inline-block;
					width: 60px;
					height: 60px;
					line-height: 60px;
					font-size: 52px;
					text-align: center;
				}

				.view{
					display: flex;
					flex-direction: column;
					justify-content: center;
					align-items: center;
					gap: 10px;
				}

				.row{
					margin: 0;
					display: flex;
					align-items: center;
					gap: 10px;
					font-weight: 400;
				}

				.spinner{
					display: inline-flex;
					justify-content: center;
					align-items: center;
				}

				.spinner:before{
					content: '';
					display: inline-block;
					width: 15px;
					height: 15px;
					border: 2px solid currentColor;
					border-right: 2px solid transparent;
					border-radius: 50%;
					animation: spin 1s linear infinite;
				}

				@keyframes spin{
					0%{
						transform: rotate(0deg);
					}
					100%{
						transform: rotate(360deg);
					}
				}
				
				input[type="checkbox"]{
					accent-color: #ffcd19;
				}

				button{
					padding: 10px 25px;
					background-color: #ffcd19;
					border: none;
					border-radius: 5px;
					font-size: 14px;
					color: #fff;
					box-shadow: 0 5px 10px -5px rgba(0, 0, 0, 0.3);
					transition: all 0.2s ease;
					cursor: pointer;
				}

				button:active{
					transform: translateY(1px);
					box-shadow: none;
				}
			</style>
		</head>

		<body>
			<div class="icon">🍌</div>
			<h1>Bununban</h1>

			<div id="main-view" class="view">
				${
					hasSettings
						? `
							<label class="row">
								<input id="clear-settings" type="checkbox"> 
								${ isInstalled ? 'Сбросить настройки' : 'Сбросить предыдущие настройки' }
							</label>
						`
						: ''
				}
				${
					isInstalled
						? `<button id="uninstall" type="button">Удалить</button>`
						: `<button id="install" type="button">Установить</button>`
				}
			</div>

			<script>
				const installBtn = document.querySelector('#install');
				const uninstallBtn = document.querySelector('#uninstall');
				const clrSettingsCheckbox = document.querySelector('#clear-settings');
				const view = document.querySelector('#main-view');

				const setStatus = text => {
					const statusEl = document.querySelector('#status');

					if( statusEl )
						statusEl.innerText = text;
				}

				const waitAvailability = async url => {
					try{
						await fetch(url);
					}
					catch(e){
						await new Promise(resolve => setTimeout(resolve, 500));
						return waitAvailability(url);
					}
				}

				const finish = (label, url = null) => {
					view.innerHTML = '<button id="exit" type="button">' + label + '</button>';

					document.querySelector('#exit')
						.addEventListener('click', async () => {
							if( url )
								await openUrl(url);

							await closeSetup();
						});
				}

				installBtn?.addEventListener?.('click', async () => {
					const clr = clrSettingsCheckbox?.checked ?? false;

					view.innerHTML = \`
						<div class="row">
							<div class="spinner"></div>
							<div id="status">Установка...</div>
						</div>
					\`;

					const url = await installApp(clr);

					setStatus('Загрузка ресурсов...');

					await waitAvailability(url + '/api/ping');

					finish('Начать', url);
				});

				uninstallBtn?.addEventListener?.('click', async () => {
					const clr = clrSettingsCheckbox?.checked ?? false;

					view.innerHTML = \`
						<div class="row">
							<div class="spinner"></div>
							<div id="status">Удаление...</div>
						</div>
					\`;

					await uninstallApp(clr);

					finish('Закрыть');
				});
			</script>
		</body>
	</html>
`);

await WebUI.wait();

process.exit();