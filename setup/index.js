import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dlopen, FFIType } from 'bun:ffi'

import { intro, outro, confirm, spinner, log, isCancel } from '@clack/prompts'

import { APPDATA_DIR } from '../src/backend/utils/appdata'
import settings from '../src/backend/stores/settings'

import modernBin from '../dist/bununban-windows-x64.exe.gz' with { type: 'file' }
import baselineBin from '../dist/bununban-windows-x64-no-simd.exe.gz' with { type: 'file' }

import ico from '../src/frontend/assets/favicon.ico' with { type: 'file' }
import lnk from './Bununban.lnk' with { type: 'file' }
import dll from '../node_modules/@webui-dev/bun-webui/src/webui-windows-msvc-x64/webui-2.dll' with { type: 'file' }

const AVX2_SUPPORT = (() => {
	const PF_AVX2_INSTRUCTIONS_AVAILABLE = 40;

	const kernel32 = dlopen('kernel32.dll', {
		IsProcessorFeaturePresent: {
			args: [FFIType.u32],
			returns: FFIType.bool,
		},
	});

	try{
		return kernel32.symbols.IsProcessorFeaturePresent(PF_AVX2_INSTRUCTIONS_AVAILABLE);
	}
	catch(e){}

	return false;
})()

const MODERN_PATH = 'C:\\bununban\\bununban-windows-x64.exe'
const BASELINE_PATH = 'C:\\bununban\\bununban-windows-x64-no-simd.exe'

const BIN_PATH = AVX2_SUPPORT ? MODERN_PATH : BASELINE_PATH
const BIN = await Bun.file( AVX2_SUPPORT ? modernBin : baselineBin ).bytes()

const ICO_PATH = 'C:\\bununban\\icon.ico'
const ICO = await Bun.file(ico).arrayBuffer()

const LNK_PATH = join(homedir(), 'Desktop', 'Bununban.lnk')
const LNK = await Bun.file(lnk).arrayBuffer()

const IS_INSTALLED = (
	await Bun.file(MODERN_PATH).exists()
	||
	await Bun.file(BASELINE_PATH).exists()
)

const HAS_SETTINGS = await Bun.file( join(APPDATA_DIR, 'settings') ).exists()

const PORT = await settings.get('port') ?? '8008'
const HOSTNAME = await settings.get('hostname') ?? '0.0.0.0'

const sh = cmd => {
	try{
		execSync(cmd, { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true })
	}
	catch(e){}
}

const installApp = clr => {
	if( clr )
		sh(`rmdir /s /q ${ APPDATA_DIR }`);

	sh(`mkdir C:\\bununban`);
	writeFileSync(BIN_PATH, Bun.gunzipSync(BIN));
	writeFileSync(ICO_PATH, ICO);
	writeFileSync(LNK_PATH, LNK);
	sh(`netsh interface tcp set global timestamps=enabled`);
	sh(`schtasks /create /tn "bununban" /tr "${ BIN_PATH }" /sc onlogon /rl highest`);
	sh(`schtasks /run /tn "bununban"`);

	return HAS_SETTINGS && !clr
		? `http://${ HOSTNAME == '0.0.0.0' ? 'localhost' : HOSTNAME }:${ PORT }`
		: `http://localhost:8008`;
}

const uninstallApp = clr => {
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
}

const openUrl = url => {
	sh(`start ${ url }`);
	return true;
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

const runCLI = async () => {
	if( IS_INSTALLED ){
		const clr = (
			HAS_SETTINGS
				? await confirm({
					message: 'Сбросить настройки?',
					active: 'Да',
					inactive: 'Нет',
				})
				: false
		);

		if( isCancel(clr) )
			process.exit();

		const spin = spinner();

		spin.start('Удаление...');
		await uninstallApp(clr);

		spin.stop('Удаление завершено');	
	}
	else
	{
		const clr = (
			HAS_SETTINGS
				? await confirm({
					message: 'Сбросить предыдущие настройки?',
				})
				: false
		);

		if( isCancel(clr) )
			process.exit();

		const spin = spinner();

		spin.start('Установка...');
		const url = await installApp(clr);

		spin.message('Загрузка ресурсов...');
		await waitAvailability(url + '/api/ping');

		spin.stop('Установка завершена');

		openUrl(url);
	}
}

const runGUI = async () => {
	log.message('Запуск интерфейса WebUI...');

	let guiStarted = false;

	const dllFile = Bun.file(dll);

	if( process.env.NODE_ENV === 'production' && !(await dllFile.exists()) )
		await Bun.write('./webui-windows-msvc-x64/webui-2.dll', await dllFile.arrayBuffer());

	const { WebUI } = await import('@webui-dev/bun-webui');

	const window = new WebUI();

	window.setSize(500, 250);
	window.setFrameless(true);
	window.setTransparent(true);
	window.setResizable(false);
	window.setCenter();

	window.bind('guiStarted', async e => {
		guiStarted = true;
	});

	window.bind('installApp', async e => {
		const clr = e.arg.boolean(0);
		return installApp(clr);
	});

	window.bind('uninstallApp', async e => {
		const clr = e.arg.boolean(0);
		return uninstallApp(clr);
	});

	window.bind('openUrl', async e => {
		const url = e.arg.string(0);
		return openUrl(url);
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
						height: 40px;
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

					.close{
						position: fixed;
						top: 3px;
						right: 4px;
						width: 40px;
						height: 40px;
						display: flex;
						justify-content: center;
						align-items: center;
						border-top-right-radius: 5px;
						line-height: 1;
						font-size: 18px;
						font-weight: 600;
						color: #555;
						z-index: 99;
					}

					.close:hover{
						background: #e81123;
						color: white;
					}
				</style>
			</head>

			<body>
				<div class="icon">🍌</div>
				<h1>Bununban</h1>

				<div id="main-view" class="view">
					${
						HAS_SETTINGS
							? `
								<label class="row">
									<input id="clear-settings" type="checkbox"> 
									${ IS_INSTALLED ? 'Сбросить настройки' : 'Сбросить предыдущие настройки' }
								</label>
							`
							: ''
					}
					${
						IS_INSTALLED
							? `<button id="uninstall" type="button">Удалить</button>`
							: `<button id="install" type="button">Установить</button>`
					}
				</div>

				<div id="close" class="close">✕</div>

				<script>
					const closeBtn = document.querySelector('#close');
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

					closeBtn?.addEventListener?.('click', async () => {
						await guiStarted();
						await closeSetup();
					});

					installBtn?.addEventListener?.('click', async () => {
						await guiStarted();

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
						await guiStarted();

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

					setTimeout(async () => await guiStarted(), 1000);
				</script>
			</body>
		</html>
	`);

	await WebUI.wait();

	if( !guiStarted ){
		log.error('Ошибка WebUI. Процесс продолжается в окне консоли...');
		await runCLI();
	}
}

intro('Bununban 🍌');

if( Bun.argv.includes('--console') )
	await runCLI();
else
	await runGUI();

outro('Готово');

process.exit();