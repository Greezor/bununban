import { $ } from 'bun'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

import ketchup from '../../common/utils/ketchup'

import { APPDATA_DIR } from '../utils/appdata'

import lists from '../stores/lists'
import lua from '../stores/lua'
import blobs from '../stores/blobs'
import settings from '../stores/settings'

import zapret from '../utils/zapret'
import server from '../index'

const stores = {
	lists,
	lua,
	blobs,
	settings,
};

const OK = new Response('OK');

const storeToArrayEndpoint = store => async req => Response.json(
	Object.entries(await store.getAll())
		.map(([ name, props ]) => ({
			name,
			...props,
		}))
);

const getFromStoreEndpoint = storeName => async req => {
	const key = req.params.name;
	const store = stores[storeName];
	const filePath = join(APPDATA_DIR, 'files', storeName, key);
	const file = Bun.file(filePath);

	const value = await store.get(key);

	return Response.json({
		...value,
		...(
			await file.exists()
				? { content: await file.text() }
				: {}
		),
	});
};

const putToStoreEndpoint = storeName => async req => {
	const store = stores[storeName];

	let { name, content, syncUrl, ...props } = await req.json();

	await store.set(name, { ...props, syncUrl });

	const dirPath = join(APPDATA_DIR, 'files', storeName);
	const filePath = join(dirPath, name);

	if( syncUrl ){
		try{
			content = await ketchup.text(syncUrl);
		}
		catch(e){
			console.error(e)
		}
	}

	if( (content ?? null) !== null ){
		mkdirSync(dirPath, { recursive: true });
		await Bun.write(filePath, content);
	}

	const oldName = req.params.name;

	if( name !== oldName ){
		await store.delete(oldName);

		const oldFilePath = join(dirPath, oldName);
		const oldFile = Bun.file(oldFilePath);
		const newFile = Bun.file(filePath);
		
		if( !(await newFile.exists()) )
			await Bun.write(filePath, oldFile);

		await oldFile.delete();
	}

	return OK;
};

const deleteFromStoreEndpoint = storeName => async req => {
	const key = req.params.name;
	const store = stores[storeName];
	const filePath = join(APPDATA_DIR, 'files', storeName, key);
	const file = Bun.file(filePath);

	await store.delete(key);

	if( await file.exists() )
		await file.delete();

	return OK;
};

export default {
	'/api/ping': new Response('pong', { headers: { 'Access-Control-Allow-Origin': '*' } }),


	'/api/antidpi': {
		GET: () => Response.json(
			zapret.isStarted
		),
		PUT: async req => {
			const activate = await req.json();

			if( activate )
				await zapret.start();
			else
				await zapret.stop();

			await new Promise(resolve => setTimeout(resolve, 1000));
			await settings.set('antidpi.active', zapret.isStarted);

			return OK;
		},
	},
	'/api/antidpi/restart': {
		POST: async () => {
			if( zapret.isStarted )
				await zapret.restart();

			return OK;
		},
	},


	'/api/server/restart': {
		POST: () => {
			server.restart();
			return OK;
		},
	},


	'/api/profiles': {
		GET: async () => Response.json(
			await settings.get('profiles') ?? []
		),
		PUT: async req => {
			const profiles = await req.json();

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

			return OK;
		},
	},


	'/api/lists': {
		GET: storeToArrayEndpoint(lists),
	},
	'/api/lists/:name': {
		GET: getFromStoreEndpoint('lists'),
		PUT: putToStoreEndpoint('lists'),
		DELETE: deleteFromStoreEndpoint('lists'),
	},


	'/api/lua': {
		GET: storeToArrayEndpoint(lua),
	},
	'/api/lua/:name': {
		GET: getFromStoreEndpoint('lua'),
		PUT: putToStoreEndpoint('lua'),
		DELETE: deleteFromStoreEndpoint('lua'),
	},


	'/api/blobs': {
		GET: storeToArrayEndpoint(blobs),
	},
	'/api/blobs/:name': {
		GET: getFromStoreEndpoint('blobs'),
		PUT: putToStoreEndpoint('blobs'),
		DELETE: deleteFromStoreEndpoint('blobs'),
		POST: async req => {
			const formData = await req.formData();
			const src = formData.get('file');

			if( !src )
				return new Response('Empty file', { status: 400 });

			await Bun.write(join(APPDATA_DIR, 'files', 'blobs', req.params.name), src);

			return OK;
		},
	},


	'/api/startup': {
		GET: async () => Response.json(
			await settings.get('startup.scripts') ?? {
				before: '',
				after: '',
			}
		),
		PUT: async req => {
			const { before, after } = await req.json();
			await settings.set('startup.scripts', { before, after });
			return OK;
		},
	},


	'/api/logs': {
		GET: async () => {
			const logs = Bun.file(join(APPDATA_DIR, 'logs'));

			if( await logs.exists() )
				return new Response(logs);

			return new Response('');
		},
	},


	'/api/settings': {
		GET: async () => Response.json(
			await settings.getAll()
		),
		PUT: async req => {
			const data = await req.json();

			for(const [ prop, value ] of Object.entries(data))
				await settings.set(prop, value);

			return OK;
		},
	},
	'/api/settings/antidpi/zapret2/versions': {
		GET: async () => Response.json(
			await zapret.getVersions()
		),
	},
	'/api/settings/antidpi/zapret2/install/:version': {
		POST: async req => {
			await zapret.install(req.params.version);
			return OK;
		},
	},
	'/api/settings/reset': {
		POST: async () => {
			await $`rm -rf ${ APPDATA_DIR }`;
			server.restart();
			return OK;
		},
	},


	'/api/updater/update-now': {
		POST: async () => {
			await server.autoUpdate();
			return OK;
		},
	},


	'/api/cors-hole': {
		POST: async req => {
			const { url } = await req.json();
			
			return new Response(
				await ketchup.text(url)
			);
		},
	},
}