import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

import ketchup from '../common/utils/ketchup'

import api from './routes/api'
import frontend from './routes/frontend'

import zapret from './lib/zapret'
import migrate from './lib/migrate'
import DNSProxy from './lib/dnsProxy'

import lists from './stores/lists'
import lua from './stores/lua'
import blobs from './stores/blobs'
import settings from './stores/settings'

import { APPDATA_DIR } from './lib/appdata'
import packageJSON from '../../package.json'

class BackendApp
{
	#started = false

	#server = null
	#dnsProxy = null
	#autoUpdateInterval = null

	get IS_NSSM()
	{
		return Bun.file('C:\\bununban\\nssm.exe').exists();
	}

	async start(startup = false)
	{
		if( this.#started ) return;

		if( await this.IS_NSSM )
			await Bun.$`"C:\\bununban\\nssm.exe" set "Bununban" AppExit Default Restart`.nothrow().quiet();

		const settingsFile = Bun.file(
			join(APPDATA_DIR, 'settings')
		);

		const isFirstLaunch = !( await settingsFile.exists() );

		await this.applyMigrations();

		this.#dnsProxy = new DNSProxy();
		await this.#dnsProxy.winSetDNS(['8.8.8.8', '8.8.4.4']);

		if( await settings.get('dns.active') )
			await this.#dnsProxy.start();

		if( isFirstLaunch ){
			await this.syncProfiles(true);
			await this.syncLists(true);
			await this.syncLua(true);
			await this.syncBlobs(true);

			return await this.restart();
		}

		this.#server = Bun.serve({
			port: await settings.get('port') || '8008',
			hostname: await settings.get('hostname') || '0.0.0.0',

			idleTimeout: 255,
			development: process.env.NODE_ENV === 'development',

			routes: {
				...api,
				...frontend,
			},
		});

		console.info(`Server started at ${ this.#server.url }`);

		this.#started = true;

		if( await settings.get('antidpi.active') )
			await zapret.start();

		if( startup && await settings.get('updater.on-startup') )
			await this.autoUpdate();

		this.#autoUpdateInterval = setInterval(() => this.autoUpdate(), (
			await settings.get('updater.interval') || (1000 * 60 * 60 * 24)
		));
	}

	async stop(force = false)
	{
		clearInterval(this.#autoUpdateInterval);

		await zapret.stop();

		await this.#server?.stop?.(force);
		await this.#dnsProxy?.stop?.();

		this.#started = false;
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
		const version = await settings.get('version') || '0.0.0';
		const addNewResources = await settings.get('updater.new-resources') ?? true;

		await migrate(version, addNewResources);

		if( version != packageJSON.version )
			await settings.set('version', packageJSON.version);
	}

	async autoUpdate(force = false)
	{
		let restartNeeded = false;

		try{
			restartNeeded = await this.syncProfiles(force) || restartNeeded;
			restartNeeded = await this.syncLists(force) || restartNeeded;
			restartNeeded = await this.syncLua(force) || restartNeeded;
			restartNeeded = await this.syncBlobs(force) || restartNeeded;

			if( await this.updateZapret2(force) )
				restartNeeded = false;

			await this.updateSelf(force);
		}
		catch(e){
			console.error(e)
		}

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

		const updateScript = join( ...path, process.platform === 'win32' ? 'update.cmd' : 'update.sh' );

		await Bun.$`rm -rf ${ updateScript }`;

		const doUpdate = await settings.get('updater.self') || force;

		if( !doUpdate )
			return;

		const html = await ketchup.text('https://github.com/Greezor/bununban/releases/latest');
		const [ _, latest ] = html.match(/href="\/Greezor\/bununban\/releases\/tag\/(.*?)"/ms);

		if( Bun.semver.satisfies(packageJSON.version, `>=${ latest ?? '0.0.0' }`) )
			return;

		const updatePath = join( ...path, 'update.bin' );

		await Bun.write(updatePath, (
			Bun.gunzipSync(
				await ketchup.arrayBuffer(`https://github.com/Greezor/bununban/releases/download/${ latest }/${ bin }.gz`)
			)
		));

		if( process.platform === 'win32' ){
			if( await this.IS_NSSM )
				await Bun.$`"C:\\bununban\\nssm.exe" set "Bununban" AppExit Default Ignore`.nothrow().quiet();

			const args = Bun.argv.slice(2)
				.map(arg => `'${
					arg
						.replace(/"/g, '\\"')
						.replace(/'/g, '\\\'')
				}'`);

			await Bun.write(updateScript, `powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; Move-Item -Path '${ updatePath }' -Destination '${ process.execPath }' -Force; Start-Process -FilePath '${ process.execPath }'${ args.length ? ` -ArgumentList ${ args.join(', ') }` : '' }"`);

			Bun.spawn([ 'cmd', '/c', updateScript ], {
				windowsHide: true,
				detached: true,
				stdio: ['ignore', 'ignore', 'ignore'],
			}).unref();
		}
		else
		{
			await Bun.$`mv -f "${ updatePath }" "${ process.execPath }"`.nothrow().quiet();
			await Bun.$`chmod +x "${ process.execPath }"`.nothrow().quiet();

			await Bun.write(updateScript, `sleep 5; "${ process.execPath }" ${ Bun.argv.slice(2).join(' ') }`);

			Bun.spawn([ 'sh', updateScript ], {
				windowsHide: true,
				detached: true,
				stdio: ['ignore', 'ignore', 'ignore'],
			}).unref();
		}

		process.exit();
	}
}

export default new BackendApp()