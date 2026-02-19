import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

import ketchup from '../common/utils/ketchup'

import api from './routes/api'
import frontend from '../frontend/index.html'
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

	async start()
	{
		if( this.#server ) return;

		const settingsFile = Bun.file(
			join(APPDATA_DIR, 'settings')
		);

		if( !( await settingsFile.exists() ) )
			await this.createDefaultAppdata();

		await settings.set('version', packageJSON.version);

		try{
			const port = await settings.get('port') ?? '8008';
			const hostname = await settings.get('hostname') ?? '0.0.0.0';

			this.#server = Bun.serve({
				idleTimeout: 255,

				port,
				hostname,

				routes: {
					...api,
					'/*': frontend,
				},

				development: process.env.NODE_ENV === 'development',
			});

			console.info(`Server started at http://${ hostname == '0.0.0.0' ? 'localhost' : hostname }:${ port }`);

			if( await settings.get('antidpi.active') )
				await zapret.start();

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

	async createDefaultAppdata()
	{
		// profiles
		await settings.set('profiles', [
			{ 'name': 'quic', 'active': true,'syncUrl': 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/quic.sh', 'content': '' },
			{ 'name': 'discord', 'active': true,'syncUrl': 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/discord.sh', 'content': '' },
			{ 'name': 'stun', 'active': true,'syncUrl': 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/stun.sh', 'content': '' },
			{ 'name': 'wireguard', 'active': true,'syncUrl': 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/wireguard.sh', 'content': '' },
			{ 'name': 'unknown-udp', 'active': true,'syncUrl': 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/unknown-udp.sh', 'content': '' },
			{ 'name': 'google', 'active': true,'syncUrl': 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/google.sh', 'content': '' },
			{ 'name': 'tls', 'active': true,'syncUrl': 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/tls.sh', 'content': '' },
		]);

		// lists
		await lists.set('rulist', { syncUrl: 'https://raw.githubusercontent.com/bol-van/rulist/refs/heads/main/reestr_hostname.txt' });
		await lists.set('apple', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-apple.txt' });
		await lists.set('cloudflare', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-cloudflare.txt' });
		await lists.set('discord', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-discord.txt' });
		await lists.set('instagram', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-instagram.txt' });
		await lists.set('meta', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-meta.txt' });
		await lists.set('rutor', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-rutor.txt' });
		await lists.set('rutracker', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-rutracker.txt' });
		await lists.set('speedtest', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-speedtest.txt' });
		await lists.set('telegram', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-telegram.txt' });
		await lists.set('tor', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-tor.txt' });
		await lists.set('twitter', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-twitter.txt' });
		await lists.set('viber', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-viber.txt' });
		await lists.set('riotgames', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/riotgames.txt' });
		await lists.set('roblox', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/roblox.txt' });
		await lists.set('vrchat', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/vrchat.txt' });
		await lists.set('whatsapp', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/whatsapp.txt' });
		await lists.set('google', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/google.txt' });
		await lists.set('custom', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/custom.txt' });

		// lua
		await lua.set('zapret-lib', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-lib.lua' });
		await lua.set('zapret-antidpi', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-antidpi.lua' });
		await lua.set('zapret-auto', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-auto.lua' });
		await lua.set('bununban-lib', { active: true, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lua/bununban-lib.lua' });

		// fakes
		await blobs.set('quic_initial_www_google_com', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/files/fake/quic_initial_www_google_com.bin' });
		await blobs.set('tls_clienthello_www_google_com', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/files/fake/tls_clienthello_www_google_com.bin' });

		// settings
		await settings.set('hostname', '0.0.0.0');
		await settings.set('port', '8008');
		await settings.set('updater.self', true);
		await settings.set('updater.zapret2', true);
		await settings.set('updater.profiles', true);
		await settings.set('updater.lists', true);
		await settings.set('updater.lua', true);
		await settings.set('updater.blobs', true);
		await settings.set('updater.interval', 1000 * 60 * 60 * 24);
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

		if( restartNeeded )
			await zapret.restart();
	}

	async syncProfiles(force = false)
	{
		if( !( await settings.get('updater.profiles') || force ) )
			return false;

		const profiles = await settings.get('profiles');
		let isUpdated = false;

		for(const profile of profiles){
			if( profile.syncUrl && ( !Array.isArray(force) || force.includes(profile.name) ) ){
				try{
					const content = await ketchup.text(profile.syncUrl);

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

		if( isUpdated )
			await settings.set('profiles', profiles);

		return isUpdated;
	}

	async syncFiles(store, dir, whitelist = null)
	{
		const files = await store.getAll();
		let isUpdated = false;

		for(const [ filename, { syncUrl } ] of Object.entries(files)){
			if( syncUrl && ( !Array.isArray(whitelist) || whitelist.includes(filename) ) ){
				try{
					const content = await ketchup.arrayBuffer(syncUrl);

					const dirPath = join(APPDATA_DIR, 'files', dir);
					const filePath = join(dirPath, filename);

					mkdirSync(dirPath, { recursive: true });

					const file = Bun.file(filePath);

					if( await file.exists() )
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

		return isUpdated;
	}

	async syncLists(force = false)
	{
		if( !( await settings.get('updater.lists') || force ) )
			return false;

		return await this.syncFiles(lists, 'lists', force);
	}

	async syncLua(force = false)
	{
		if( !( await settings.get('updater.lua') || force ) )
			return false;

		return await this.syncFiles(lua, 'lua', force);
	}

	async syncBlobs(force = false)
	{
		if( !( await settings.get('updater.blobs') || force ) )
			return false;

		return await this.syncFiles(blobs, 'blobs', force);
	}

	async updateZapret2(force = false)
	{
		if( !( await settings.get('updater.zapret2') || force ) )
			return false;

		return await zapret.install();
	}

	async updateSelf(force = false)
	{
		if( process.env.NODE_ENV === 'development' )
			return;

		if( !( await settings.get('updater.self') || force ) )
			return;

		const html = await ketchup.text('https://github.com/Greezor/bununban/releases/latest');
		const [ _, latest ] = html.match(/href="\/Greezor\/bununban\/releases\/tag\/(.*?)"/ms);

		if( await settings.get('version') === latest )
			return;

		const path = process.execPath.split(/\\|\//);
		const bin = path.pop();
		const updatePath = join( ...path, 'update.bin' );
		const binPath = join( ...path, bin );

		await Bun.write(
			updatePath,
			await ketchup.arrayBuffer(`https://github.com/Greezor/bununban/releases/latest/download/${ bin }`),
		);

		const proc = Bun.spawn((
			process.platform === 'win32'
				? [ 'cmd', '/c', `timeout /t 1 /nobreak & move /y ${ updatePath } ${ binPath } & powershell Start-Process -FilePath ${ binPath }` ]
				: [ 'bash', '-c', `sleep 1; mv -f ${ updatePath } ${ binPath }; chmod +x ${ binPath }; ${ binPath }` ]
		), {
			detached: true,
			stdio: ['ignore', 'ignore', 'ignore'],
		});

		proc.unref();

		await this.stop();

		process.exit();
	}
}

export default new BackendApp()