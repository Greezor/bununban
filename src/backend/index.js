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
			{ 'name': 'http', 'active': true,'syncUrl': '', 'content': '--filter-l7=http\r\n--payload=http_req\r\n--lua-desync=fake:blob=fake_default_http:ip_autottl=-2,3-20:ip6_autottl=-2,3-20:tcp_md5\r\n--lua-desync=fakedsplit:ip_autottl=-2,3-20:ip6_autottl=-2,3-20:tcp_md5' },
			{ 'name': 'tls-youtube', 'active': true,'syncUrl': '', 'content': '--filter-l7=tls\r\n--hostlist={youtube}\r\n--payload=tls_client_hello\r\n--lua-desync=fake:blob=fake_default_tls:tcp_md5:repeats=11:tls_mod=rnd,dupsid,sni=www.google.com\r\n--lua-desync=multidisorder:pos=1,midsld' },
			{ 'name': 'tls', 'active': true,'syncUrl': '', 'content': '--filter-l7=tls\r\n--payload=tls_client_hello\r\n--lua-desync=fake:blob=fake_default_tls:tcp_md5:tcp_seq=-10000:repeats=6:tls_mod=rnd,rndsni\r\n--lua-desync=multidisorder:pos=midsld' },
			{ 'name': 'quic-youtube', 'active': true,'syncUrl': '', 'content': '--filter-l7=quic\r\n--hostlist={youtube}\r\n--payload=quic_initial\r\n--lua-desync=fake:blob=quic_initial_www_google_com:repeats=11' },
			{ 'name': 'quic', 'active': true,'syncUrl': '', 'content': '--filter-l7=quic\r\n--payload=quic_initial\r\n--lua-desync=fake:blob=fake_default_quic:repeats=11' },
			{ 'name': 'discord', 'active': true,'syncUrl': '', 'content': '--filter-l7=stun,discord\r\n--payload=stun,discord_ip_discovery\r\n--lua-desync=fake:blob=0x00000000000000000000000000000000:repeats=2' },
			{ 'name': 'wireguard', 'active': true,'syncUrl': '', 'content': '--filter-l7=wireguard\r\n--payload=wireguard_initiation,wireguard_cookie\r\n--lua-desync=fake:blob=0x00000000000000000000000000000000:repeats=2' },
		]);

		// hosts
		await lists.set('rulist', { syncUrl: 'https://raw.githubusercontent.com/bol-van/rulist/refs/heads/main/reestr_hostname.txt' });
		await lists.set('youtube', { syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret-win-bundle/refs/heads/master/zapret-winws/files/list-youtube.txt' });

		// lua
		await lua.set('zapret-lib', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-lib.lua' });
		await lua.set('zapret-antidpi', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-antidpi.lua' });
		await lua.set('zapret-auto', { active: false, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-auto.lua' });

		// fakes
		await blobs.set('quic_initial_www_google_com', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/files/fake/quic_initial_www_google_com.bin' });
		await blobs.set('tls_clienthello_www_google_com', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/files/fake/tls_clienthello_www_google_com.bin' });

		// settings
		await settings.set('hostname', '0.0.0.0');
		await settings.set('port', '8008');
		await settings.set('updater.self', false);
		await settings.set('updater.zapret2', false);
		await settings.set('updater.profiles', false);
		await settings.set('updater.lists', false);
		await settings.set('updater.lua', false);
		await settings.set('updater.blobs', false);
		await settings.set('updater.interval', 1000 * 60 * 60 * 24);
		await settings.set('antidpi.debug', false);

		if( process.platform === 'win32' ){
			// windivert filters
			await lists.set('windivert-discord', { syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret-win-bundle/refs/heads/master/zapret-winws/windivert.filter/windivert_part.discord_media.txt' });
			await lists.set('windivert-quic', { syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret-win-bundle/refs/heads/master/zapret-winws/windivert.filter/windivert_part.quic_initial_ietf.txt' });
			await lists.set('windivert-stun', { syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret-win-bundle/refs/heads/master/zapret-winws/windivert.filter/windivert_part.stun.txt' });
			await lists.set('windivert-wireguard', { syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret-win-bundle/refs/heads/master/zapret-winws/windivert.filter/windivert_part.wireguard.txt' });

			// startup args
			await settings.set('startup.args', '--wf-tcp-out=80,443 --wf-raw-part=@{windivert-discord} --wf-raw-part=@{windivert-stun} --wf-raw-part=@{windivert-wireguard} --wf-raw-part=@{windivert-quic}');
		}

		await this.syncProfiles(true);
		await this.syncLists(true);
		await this.syncLua(true);
		await this.syncBlobs(true);
	}

	async autoUpdate(force = false)
	{
		const wasStarted = zapret.isStarted;

		await this.syncProfiles(force);
		await this.syncLists(force);
		await this.syncLua(force);
		await this.syncBlobs(force);

		await zapret.stop();

		await this.updateZapret2(force);
		await this.updateSelf(force);

		if( wasStarted && !zapret.isStarted )
			await zapret.start();
	}

	async syncProfiles(force = false)
	{
		if( !( await settings.get('updater.profiles') || force ) )
			return;

		const profiles = await settings.get('profiles');
		
		for(const profile of profiles){
			if( profile.syncUrl ){
				try{
					profile.content = await ketchup.text(profile.syncUrl);
				}
				catch(e){
					console.error(e)
				}
			}
		}

		await settings.set('profiles', profiles);
	}

	async syncFiles(store, dir)
	{
		const files = await store.getAll();

		for(const [ filename, { syncUrl } ] of Object.entries(files)){
			if( syncUrl ){
				try{
					const content = await ketchup.text(syncUrl);

					const dirPath = join(APPDATA_DIR, 'files', dir);
					const filePath = join(dirPath, filename);

					mkdirSync(dirPath, { recursive: true });
					await Bun.write(filePath, content);
				}
				catch(e){
					console.error(e)
				}
			}
		}
	}

	async syncLists(force = false)
	{
		if( !( await settings.get('updater.lists') || force ) )
			return;

		await this.syncFiles(lists, 'lists');
	}

	async syncLua(force = false)
	{
		if( !( await settings.get('updater.lua') || force ) )
			return;

		await this.syncFiles(lua, 'lua');
	}

	async syncBlobs(force = false)
	{
		if( !( await settings.get('updater.blobs') || force ) )
			return;

		await this.syncFiles(blobs, 'blobs');
	}

	async updateZapret2(force = false)
	{
		if( !( await settings.get('updater.zapret2') || force ) )
			return;

		await zapret.install();
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
				: [ 'bash', '-c', `sleep 1; mv -f ${ updatePath } ${ binPath }; ${ binPath }` ]
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