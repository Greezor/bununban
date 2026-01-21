import { $ } from 'bun'
import { join } from 'node:path'
import { arch, platform } from 'node:os'
import { Readable } from 'node:stream'

import { parseTarGzip } from 'nanotar'
import stringArgv from 'string-argv'

import { APPDATA_DIR } from './appdata'
import modifyBinarySubsystem from './modifyBinarySubsystem'

import lists from '../stores/lists'
import lua from '../stores/lua'
import blobs from '../stores/blobs'
import settings from '../stores/settings'

class Zapret
{
	#proc = null;

	constructor()
	{
		this.arch = arch();
		this.platform = platform();

		switch(this.arch){
			case 'x64':
				this.arch = 'x86_64';
				break;
		}

		switch(this.platform){
			case 'win32':
				this.platform = 'windows';
				break;
		}
	}

	async getVersions()
	{
		const versions = [];
		let pageVersions = [];

		const regex = new RegExp(`href="/bol-van/zapret2/releases/tag/(.*?)"`, 'g');

		do{
			const response = await fetch(`https://github.com/bol-van/zapret2/tags${ pageVersions.length ? `?after=${ pageVersions.at(-1) }` : '' }`);
			const html = await response.text();

			pageVersions = [ ...html.matchAll(regex) ]
				.map(([ substr, tag ]) => tag)
				.filter((tag, i, arr) => arr.indexOf(tag) === i);

			versions.push(...pageVersions);
		}
		while(pageVersions.length)

		return versions;
	}

	async deleteWindivert()
	{
		if( this.platform != 'windows' )
			return;

		try{
			await $`sc delete windivert; sc stop windivert`.quiet();
		}
		catch(e){}
	}

	get nfqws()
	{
		return join(APPDATA_DIR, 'bin', (
			this.platform === 'windows'
				? 'winws2.exe'
				: 'nfqws2'
		));
	}

	async install(version)
	{
		await this.stop();

		if( !version ){
			const [ latest ] = await this.getVersions();
			version = latest;
		}

		let data;

		try{
			const response = await fetch(`https://github.com/bol-van/zapret2/releases/download/${ version }/zapret2-${ version }.tar.gz`);
			const buffer = await response.arrayBuffer();
			data = new Uint8Array(buffer);
		}
		catch(e){
			throw new Error(`Tarball ${ version } not found`, {
				cause: {
					code: 'TAR_NOT_FOUND',
				},
			});
		}

		try{
			const files = await parseTarGzip(data, {
				filter: file => file.name.startsWith(`zapret2-${ version }/binaries/${ this.platform }-${ this.arch }/`),
			});

			if( !files.length )
				throw 0;

			await this.deleteWindivert();

			await $`rm -rf ${ join(APPDATA_DIR, 'bin') }`;
			await $`mkdir -p ${ join(APPDATA_DIR, 'bin') }`;

			for(const file of files){
				const filename = file.name.split('/').pop();

				if( !filename ) continue;

				await Bun.write(
					join(APPDATA_DIR, 'bin', filename),
					new Blob([file.data]),
				);
			}

			if( this.platform === 'windows' )
				modifyBinarySubsystem(this.nfqws);
			else
				await $`chmod +x ${ this.nfqws }`;
		}
		catch(e){
			throw new Error(`Tarball unpack error`, {
				cause: {
					code: 'UNTAR_FAILED',
				},
			});
		}

		await settings.set('antidpi', 'zapret2');
		await settings.set('antidpi.version', version);

		if( await settings.get('antidpi.active') )
			await this.start();
	}

	async isInstalled()
	{
		const nfqws = Bun.file(this.nfqws);

		return (
			await settings.get('antidpi') === 'zapret2'
			&&
			await settings.get('antidpi.version')
			&&
			await nfqws.exists()
		);
	}

	get isStarted()
	{
		return !!this.#proc;
	}

	async replaceVarsWithLists(str)
	{
		for(const name of Object.keys( await lists.getAll() ?? {} )){
			str = str
				.replace(
					new RegExp(`{${ name }}`, 'g'),
					join(APPDATA_DIR, 'files', 'lists', name),
				);
		}

		return str;
	}

	async start()
	{
		if( !( await this.isInstalled() ) )
			await this.install();

		if( this.isStarted )
			return;

		const logsPath = join(APPDATA_DIR, 'logs');

		await $`rm -f ${ logsPath }`;
		await $`touch ${ logsPath }`;

		const { before, after } = await settings.get('startup.scripts') ?? {};

		if( before )
			await $`${{ raw: await this.replaceVarsWithLists(before) }}`;

		const logsFile = Bun.file(logsPath);
		const logsWriter = logsFile.writer();

		this.#proc = Bun.spawn([
			this.nfqws,

			(
				await settings.get('antidpi.debug')
					? '--debug'
					: ''
			),

			...(
				Object.entries( await lua.getAll() ?? {} )
					.filter(([ name, props ]) => props.active)
					.map(([ name, props ]) => (
						`--lua-init=@${
							join(APPDATA_DIR, 'files', 'lua', name)
						}`
					))
			),

			...(
				Object.entries( await blobs.getAll() ?? {} )
					.filter(([ name, props ]) => props.active)
					.map(([ name, props ]) => (
						`--blob=${ name }:@${
							join(APPDATA_DIR, 'files', 'blobs', name)
						}`
					))
			),

			...stringArgv(
				await this.replaceVarsWithLists(
					await settings.get('startup.args') ?? ''
				)
			),

			...stringArgv(
				await this.replaceVarsWithLists(
					( await settings.get('profiles') ?? [] )
						.filter(({ active }) => active)
						.map(({ content }) => (
							content
								.replace(/\r?\n/g, ' ')
								.replace(/\s+\s/g, ' ')
								.trim()
						))
						.join(' --new ')
				)
			),
		], {
			cwd: APPDATA_DIR,
			stdout: 'pipe',
			stderr: 'pipe',
			onExit: async () => {
				if( after )
					await $`${{ raw: await this.replaceVarsWithLists(after) }}`;

				await this.deleteWindivert();

				logsWriter.end();

				this.#proc = null;
			},
		});

		const stdout = Readable.fromWeb(this.#proc.stdout);
		const stderr = Readable.fromWeb(this.#proc.stderr);

		stdout.on('data', out => {
			logsWriter.write(out);
		});

		stderr.on('data', err => {
			logsWriter.write(err);
		});
	}

	async stop()
	{
		if( !this.isStarted )
			return;

		if( !this.#proc.killed )
			this.#proc.kill();

		do{
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
		while(this.isStarted)
	}

	async restart()
	{
		await this.stop();
		await this.start();
	}
}

export default new Zapret()