import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

import ketchup from '../common/utils/ketchup'

import api from './routes/api'
import frontend from './routes/frontend'

import zapret from './utils/zapret'

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

		if( isFirstLaunch )
			await this.createDefaultAppdata();

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

			const updateOnStartup = await settings.get('updater.on-startup') ?? true;

			if( startup && !isFirstLaunch && updateOnStartup )
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
		setTimeout(() => {}, 15000); // keep process

		await this.stop();
		await new Promise(resolve => setTimeout(resolve, 3000));
		await this.start();
	}

	get defaultResources()
	{
		return {
			profiles: [
				{ name: 'google', active: true, priority: 3, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/google.sh', content: '' },
				{ name: 'quic', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/quic.sh', content: '' },
				{ name: 'discord', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/discord.sh', content: '' },
				{ name: 'stun', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/stun.sh', content: '' },
				{ name: 'wireguard', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/wireguard.sh', content: '' },
				{ name: 'tls', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/tls.sh', content: '' },
				{ name: 'unknown-udp', active: true, priority: 1, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/unknown-udp.sh', content: '' },
			],
			lists: [
				[ 'rulist', { syncUrl: 'https://raw.githubusercontent.com/bol-van/rulist/refs/heads/main/reestr_hostname.txt' } ],
				[ 'apple', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-apple.txt' } ],
				[ 'cloudflare', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-cloudflare.txt' } ],
				[ 'discord', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-discord.txt' } ],
				[ 'instagram', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-instagram.txt' } ],
				[ 'meta', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-meta.txt' } ],
				[ 'rutor', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-rutor.txt' } ],
				[ 'rutracker', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-rutracker.txt' } ],
				[ 'speedtest', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-speedtest.txt' } ],
				[ 'telegram', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-telegram.txt' } ],
				[ 'tor', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-tor.txt' } ],
				[ 'twitter', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-twitter.txt' } ],
				[ 'viber', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-viber.txt' } ],
				[ 'riotgames', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/riotgames.txt' } ],
				[ 'roblox', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/roblox.txt' } ],
				[ 'vrchat', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/vrchat.txt' } ],
				[ 'whatsapp', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/whatsapp.txt' } ],
				[ 'google', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/google.txt' } ],
				[ 'custom', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/custom.txt' } ],
			],
			lua: [
				[ 'zapret-lib', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-lib.lua' } ],
				[ 'zapret-antidpi', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-antidpi.lua' } ],
				[ 'zapret-auto', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-auto.lua' } ],
				[ 'bununban-lib', { active: true, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lua/bununban-lib.lua' } ],
			],
			blobs: [
				[ 'quic_initial_www_google_com', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/files/fake/quic_initial_www_google_com.bin' } ],
				[ 'tls_clienthello_www_google_com', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/files/fake/tls_clienthello_www_google_com.bin' } ],
			],
		};
	}

	async createDefaultAppdata()
	{
		const defs = this.defaultResources;

		// profiles
		await settings.set('profiles', defs.profiles);

		// lists
		for(let [ key, def ] of defs.lists)
			await lists.set(key, def);

		// lua
		for(let [ key, def ] of defs.lua)
			await lua.set(key, def);

		// fakes
		for(let [ key, def ] of defs.blobs)
			await blobs.set(key, def);

		// settings
		await settings.set('hostname', '0.0.0.0');
		await settings.set('port', '8008');
		await settings.set('updater.self', true);
		await settings.set('updater.zapret2', true);
		await settings.set('updater.profiles', true);
		await settings.set('updater.lists', true);
		await settings.set('updater.lua', true);
		await settings.set('updater.blobs', true);
		await settings.set('updater.auto-add', true);
		await settings.set('updater.auto-delete', true);
		await settings.set('updater.interval', 1000 * 60 * 60 * 24);
		await settings.set('updater.on-startup', true);
		await settings.set('antidpi.debug', false);

		if( process.platform === 'win32' ){
			await settings.set('hostname', 'localhost');
			await settings.set('startup.args', '--wf-tcp-out=80,443-65535 --wf-udp-out=80,443-65535');
		}

		await this.syncProfiles(true);
		await this.syncLists(true);
		await this.syncLua(true);
		await this.syncBlobs(true);
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
		const doSync = await settings.get('updater.profiles') ?? true;
		const autoAdd = await settings.get('updater.auto-add') ?? true;
		const autoDelete = await settings.get('updater.auto-delete') ?? true;

		const profiles = await settings.get('profiles');
		let isUpdated = false;

		if( autoAdd ){
			for(const def of this.defaultResources.profiles){
				const index = profiles.findIndex(({ name }) => name === def.name);
				const profile = profiles?.[index];

				if( !profile ){
					profiles.push(def);
					isUpdated = true;
				}
				else
				{
					const { content: contentA, ...profileA } = def;
					const { content: contentB, ...profileB } = profile;

					if( !Bun.deepEquals(profileA, profileB) ){
						profiles[index] = def;
						isUpdated = true;
					}
				}
			}
		}

		const profilesSet = new Set(profiles);

		if( doSync || force ){
			for(const profile of profiles.slice()){
				if( profile.syncUrl && ( !Array.isArray(force) || force.includes(profile.name) ) ){
					try{
						const response = await ketchup.raw(profile.syncUrl);
						
						if( autoDelete && [404, 410, 451].includes(response.status) ){
							profilesSet.delete(profile);
							isUpdated = true;
							continue;
						}

						const content = await response.text();

						if( profile.content === content )
							continue;

						profile.content = content;
						isUpdated = true;
					}
					catch(e){
						console.error(e)
					}
				}
			}
		}

		if( isUpdated )
			await settings.set('profiles', [ ...profilesSet ]);

		return isUpdated;
	}

	async syncFiles(store, groupName, whitelist = null)
	{
		const doSync = await settings.get(`updater.${ groupName }`) ?? true;
		const autoAdd = await settings.get('updater.auto-add') ?? true;
		const autoDelete = await settings.get('updater.auto-delete') ?? true;

		let files = await store.getAll();
		let isUpdated = false;

		if( autoAdd ){
			for(const [ key, def ] of this.defaultResources?.[groupName] ?? []){
				const file = files?.[key];

				if( !file || !Bun.deepEquals(file, def) ){
					await store.set(key, def);
					isUpdated = true;
				}
			}
		}

		if( isUpdated )
			files = await store.getAll();

		if( doSync || whitelist ){
			for(const [ filename, { syncUrl } ] of Object.entries(files)){
				if( syncUrl && ( !Array.isArray(whitelist) || whitelist.includes(filename) ) ){
					try{
						const response = await ketchup.raw(syncUrl);

						const dirPath = join(APPDATA_DIR, 'files', groupName);
						const filePath = join(dirPath, filename);

						mkdirSync(dirPath, { recursive: true });

						const file = Bun.file(filePath);
						const fileExists = await file.exists();

						if( autoDelete && [404, 410, 451].includes(response.status) ){
							await store.delete(filename);
							
							if( fileExists )
								await file.delete();

							isUpdated = true;
							continue;
						}

						const content = await response.arrayBuffer();

						if( fileExists )
							if( Bun.hash(await file.arrayBuffer()) === Bun.hash(content) )
								continue;

						await Bun.write(filePath, content);
						isUpdated = true;
					}
					catch(e){
						console.error(e)
					}
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
		const doUpdate = await settings.get('updater.zapret2') ?? true;

		if( !doUpdate && !force )
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

		const doUpdate = await settings.get('updater.self') ?? true;

		if( !doUpdate && !force )
			return;

		const html = await ketchup.text('https://github.com/Greezor/bununban/releases/latest');
		const [ _, latest ] = html.match(/href="\/Greezor\/bununban\/releases\/tag\/(.*?)"/ms);

		if( packageJSON.version === latest )
			return;

		const updatePath = join( ...path, 'update.bin' );

		await Bun.write(updatePath, await ketchup.arrayBuffer(`https://github.com/Greezor/bununban/releases/latest/download/${ bin }`));

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