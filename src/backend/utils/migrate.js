import { join } from 'node:path'

import lists from '../stores/lists'
import lua from '../stores/lua'
import blobs from '../stores/blobs'
import settings from '../stores/settings'

import { APPDATA_DIR } from './appdata'

export default async (version, addNewResources) => {

	if( Bun.semver.satisfies(version, '<0.3.0') ){
		// settings
		await settings.set('hostname', '0.0.0.0');
		await settings.set('port', '8008');
		await settings.set('password', '');
		await settings.set('updater.self', true);
		await settings.set('updater.zapret2', true);
		await settings.set('updater.profiles', true);
		await settings.set('updater.lists', true);
		await settings.set('updater.lua', true);
		await settings.set('updater.blobs', true);
		await settings.set('updater.new-resources', true);
		await settings.set('updater.interval', 1000 * 60 * 60 * 24);
		await settings.set('updater.on-startup', true);
		await settings.set('antidpi.debug', false);

		if( process.platform === 'win32' ){
			await settings.set('hostname', 'localhost');
			await settings.set('startup.args', '--wf-tcp-out=80,443-65535 --wf-udp-out=80,443-65535');
		}

		// resources
		if( addNewResources ){
			// delete old files
			await Bun.$`rm -rf ${ join(APPDATA_DIR, 'files') }`;
			for(const store of [ lists, lua, blobs ]){
				for(const key of Object.keys(await store.getAll())){
					await store.delete(key);
				}
			}
			
			// profiles
			await settings.set('profiles', [
				{ name: 'google', active: true, priority: 3, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/google.sh', content: '' },
				{ name: 'quic', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/quic.sh', content: '' },
				{ name: 'discord', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/discord.sh', content: '' },
				{ name: 'stun', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/stun.sh', content: '' },
				{ name: 'wireguard', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/wireguard.sh', content: '' },
				{ name: 'tls', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/tls.sh', content: '' },
				{ name: 'mtproto', active: true, priority: 2, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/mtproto.sh', content: '' },
				{ name: 'unknown-udp', active: true, priority: 1, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/unknown-udp.sh', content: '' },
				{ name: 'unknown-tcp', active: true, priority: 1, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/profiles/unknown-tcp.sh', content: '' },
			]);

			// ipsets
			await lists.set('ipset-all', { syncUrl: 'https://raw.githubusercontent.com/V3nilla/IPSets-For-Bypass-in-Russia/refs/heads/main/ipset-all.txt' });
			await lists.set('ipset-exclude', { syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/ipset/zapret-hosts-user-exclude.txt.default' });
			await lists.set('ipset-telegram', { syncUrl: 'https://core.telegram.org/resources/cidr.txt' });
			await lists.set('ipset-roblox', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/ipsets/roblox.txt' });

			// lists
			await lists.set('rulist', { syncUrl: 'https://raw.githubusercontent.com/bol-van/rulist/refs/heads/main/reestr_hostname.txt' });
			await lists.set('google', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/google.txt' });
			await lists.set('apple', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-apple.txt' });
			await lists.set('cloudflare', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-cloudflare.txt' });
			await lists.set('discord', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-discord.txt' });
			await lists.set('instagram', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-instagram.txt' });
			await lists.set('meta', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-meta.txt' });
			await lists.set('rezka', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-rezka.txt' });
			await lists.set('rutor', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-rutor.txt' });
			await lists.set('rutracker', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-rutracker.txt' });
			await lists.set('soundcloud', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-soundcloud.txt' });
			await lists.set('speedtest', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-speedtest.txt' });
			await lists.set('telegram', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-telegram.txt' });
			await lists.set('tor', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-tor.txt' });
			await lists.set('twitter', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-twitter.txt' });
			await lists.set('viber', { syncUrl: 'https://raw.githubusercontent.com/ankddev/zapret-discord-youtube/refs/heads/main/lists/list-viber.txt' });
			await lists.set('riotgames', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/riotgames.txt' });
			await lists.set('roblox', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/roblox.txt' });
			await lists.set('vrchat', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/vrchat.txt' });
			await lists.set('whatsapp', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/whatsapp.txt' });
			await lists.set('other', { syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lists/other.txt' });
			await lists.set('custom', { syncUrl: '' });

			// create empty file for custom list
			await Bun.write( join(APPDATA_DIR, 'files', 'lists', 'custom'), '' );

			// lua
			await lua.set('zapret-lib', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-lib.lua' });
			await lua.set('zapret-antidpi', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-antidpi.lua' });
			await lua.set('zapret-auto', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/lua/zapret-auto.lua' });
			await lua.set('bununban-lib', { active: true, syncUrl: 'https://raw.githubusercontent.com/Greezor/bununban/refs/heads/master/resources/lua/bununban-lib.lua' });

			// fakes
			await blobs.set('quic_initial_www_google_com', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/files/fake/quic_initial_www_google_com.bin' });
			await blobs.set('tls_clienthello_www_google_com', { active: true, syncUrl: 'https://raw.githubusercontent.com/bol-van/zapret2/refs/heads/master/files/fake/tls_clienthello_www_google_com.bin' });
		}
	}

}