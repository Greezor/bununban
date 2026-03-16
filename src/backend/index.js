import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

import ketchup from '../common/utils/ketchup'

import api from './routes/api'
import frontend from './routes/frontend'

import zapret from './utils/zapret'
import migrate from './utils/migrate'

import lists from './stores/lists'
import lua from './stores/lua'
import blobs from './stores/blobs'
import settings from './stores/settings'

import { APPDATA_DIR } from './utils/appdata'
import packageJSON from '../../package.json'

class BackendApp
{
	#server = null;
	#autoUpdateInterval = null;

	async start(startup = false)
	{
		if( this.#server ) return;

		const settingsFile = Bun.file(
			join(APPDATA_DIR, 'settings')
		);

		const isFirstLaunch = !( await settingsFile.exists() );

		await this.applyMigrations();

		if( isFirstLaunch ){
			await this.syncProfiles(true);
			await this.syncLists(true);
			await this.syncLua(true);
			await this.syncBlobs(true);
		}

		try{
			const port = await settings.get('port') ?? '8008';
			const hostname = await settings.get('hostname') ?? '0.0.0.0';

			this.#server = Bun.serve({
				idleTimeout: 255,

				port,
				hostname,

				routes: {
					...api,
					...frontend,
				},

				// temporary fix bun bug with cache (etag not updating)
				development: true // process.env.NODE_ENV === 'development',
			});

			console.info(`Server started at http://${ hostname == '0.0.0.0' ? 'localhost' : hostname }:${ port }`);

			if( await settings.get('antidpi.active') )
				await zapret.start();

			if( startup && !isFirstLaunch && await settings.get('updater.on-startup') )
				await this.autoUpdate();

			this.#autoUpdateInterval = setInterval(() => this.autoUpdate(), (
				await settings.get('updater.interval') ?? (1000 * 60 * 60 * 24)
			));
		}
		catch(e){
			console.error('Failed to start server:', e);
			throw e;
		}
	}

	async stop(force = false)
	{
		if( this.#server === null ) return;

		clearInterval(this.#autoUpdateInterval);

		await zapret.stop();

		await this.#server.stop(force);
		this.#server = null;
	}

	async restart()
	{
		setTimeout(() => {}, 60000); // keep process

		await this.stop();
		await Bun.sleep(3000);
		await this.start();
	}

	async applyMigrations()
	{
		const version = await settings.get('version') ?? '0.0.0';
		const addNewResources = await settings.get('updater.new-resources') ?? true;

		await migrate(version, addNewResources);

		if( version != packageJSON.version )
			await settings.set('version', packageJSON.version);
	}

	async autoUpdate(force = false)
	{
		let restartNeeded = false;

		restartNeeded = await this.syncProfiles(force) || restartNeeded;
		restartNeeded = await this.syncLists(force) || restartNeeded;
		restartNeeded = await this.syncLua(force) || restartNeeded;
		restartNeeded = await this.syncBlobs(force) || restartNeeded;

		if( await this.updateZapret2(force) )
			restartNeeded = false;

		await this.updateSelf(force);

		if( restartNeeded && await settings.get('antidpi.active') )
			await zapret.restart();
	}

	async syncProfiles(force = false)
	{
		const doSync = await settings.get('updater.profiles') || force;

		if( !doSync )
			return false;

		let isUpdated = false;

		const profiles = new Set( await settings.get('profiles') ?? [] );

		for(const profile of [ ...profiles ]){
			if( profile.syncUrl && ( !Array.isArray(force) || force.includes(profile.name) ) ){
				try{
					const response = await ketchup.raw(profile.syncUrl);
					const content = await response.text();
					
					if( [404, 410, 451].includes(response.status) || profile.content === content )
						continue;

					profile.content = content;
					isUpdated = true;
				}
				catch(e){
					console.error(e)
				}
			}
		}

		if( isUpdated )
			await settings.set('profiles', [ ...profiles ]);

		return isUpdated;
	}

	async syncFiles(store, groupName, whitelist = null)
	{
		const doSync = await settings.get(`updater.${ groupName }`) || !!whitelist;

		if( !doSync )
			return false;

		let isUpdated = false;

		const files = await store.getAll();

		for(const [ filename, { syncUrl } ] of Object.entries(files)){
			if( syncUrl && ( !Array.isArray(whitelist) || whitelist.includes(filename) ) ){
				try{
					const response = await ketchup.raw(syncUrl);
					const content = await response.arrayBuffer();

					const dirPath = join(APPDATA_DIR, 'files', groupName);
					const filePath = join(dirPath, filename);

					mkdirSync(dirPath, { recursive: true });

					const file = Bun.file(filePath);

					if(
						[404, 410, 451].includes(response.status)
						||
						(
							await file.exists()
							&&
							Bun.hash(await file.arrayBuffer()) === Bun.hash(content)
						)
					){
						continue;
					}

					await Bun.write(filePath, content);
					isUpdated = true;
				}
				catch(e){
					console.error(e)
				}
			}
		}

		return isUpdated;
	}

	async syncLists(force = false)
	{
		return await this.syncFiles(lists, 'lists', force);
	}

	async syncLua(force = false)
	{
		return await this.syncFiles(lua, 'lua', force);
	}

	async syncBlobs(force = false)
	{
		return await this.syncFiles(blobs, 'blobs', force);
	}

	async updateZapret2(force = false)
	{
		const doUpdate = await settings.get('updater.zapret2') || force;

		if( !doUpdate )
			return false;

		return await zapret.install();
	}

	async updateSelf(force = false)
	{
		if( process.env.NODE_ENV === 'development' )
			return;

		const path = process.execPath.split(/\\|\//);
		const bin = path.pop();

		if( path[0] == '' )
			path[0] = '/';

		const updateScript = join( ...path, process.platform === 'win32' ? 'bununban-update.cmd' : 'bununban-update.sh' );

		await Bun.$`rm -rf ${ updateScript }`;

		const doUpdate = await settings.get('updater.self') || force;

		if( !doUpdate )
			return;

		const html = await ketchup.text('https://github.com/Greezor/bununban/releases/latest');
		const [ _, latest ] = html.match(/href="\/Greezor\/bununban\/releases\/tag\/(.*?)"/ms);

		if( packageJSON.version === latest )
			return;

		const updatePath = join( ...path, 'update.bin' );

		await Bun.write(updatePath, (
			Bun.gunzipSync(
				await ketchup.arrayBuffer(`https://github.com/Greezor/bununban/releases/latest/download/${ bin }.gz`)
			)
		));

		if( process.platform === 'win32' ){
			await Bun.write(updateScript, `powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Move-Item -Path '${ updatePath }' -Destination '${ process.execPath }' -Force; Start-Process -FilePath '${ process.execPath }'"`);

			Bun.spawn([ 'cmd', '/c', updateScript ], {
				windowsHide: true,
				detached: true,
				stdio: ['ignore', 'ignore', 'ignore'],
			}).unref();
		}
		else
		{
			await Bun.write(updateScript, `sleep 2; mv -f "${ updatePath }" "${ process.execPath }"; chmod +x "${ process.execPath }"; "${ process.execPath }"`);

			Bun.spawn([ 'sh', updateScript ], {
				windowsHide: true,
				detached: true,
				stdio: ['ignore', 'ignore', 'ignore'],
			}).unref();
		}

		await this.stop(true);

		process.exit();
	}
}

export default new BackendApp()