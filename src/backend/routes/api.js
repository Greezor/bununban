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
import app from '../index'

import { generateSecret, EncryptJWT, jwtDecrypt } from 'jose'

const SESSION_KEY = 'bununban-session'
let jwtSecret = await generateSecret('A256GCM')

const stores = {
	lists,
	lua,
	blobs,
	settings,
}

const OK = new Response('OK')
const FORBIDDEN = new Response('Forbidden', { status: 403 })

const authUser = async (req, server) => {
	const { address } = server.requestIP(req);

	const jwt = await new EncryptJWT({ ip: address })
		.setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
		.setExpirationTime('2d')
		.encrypt(jwtSecret);

	req.cookies.set(SESSION_KEY, jwt, {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
	});
}

const checkAuth = async (req, server) => {
	const hash = await settings.get('password');

	if( !hash )
		return true;

	const { address } = server.requestIP(req);
	const jwt = req?.cookies?.get?.(SESSION_KEY);

	try{
		const { payload } = await jwtDecrypt(jwt, jwtSecret);
		
		if( payload.ip === address ){
			await authUser(req, server);
			return true;
		}
	}
	catch(e){}

	return false;
}

const storeToArrayEndpoint = store => async (req, server) => {
	if( !( await checkAuth(req, server) ) )
		return Response.json([]);

	return Response.json(
		Object.entries(await store.getAll())
			.map(([ name, props ]) => ({
				name,
				...props,
			}))
	);
}

const getFromStoreEndpoint = storeName => async (req, server) => {
	if( !( await checkAuth(req, server) ) )
		return Response.json(null);

	const key = req.params.name;
	const store = stores[storeName];
	const filePath = join(APPDATA_DIR, 'files', storeName, key);
	const file = Bun.file(filePath);

	const value = await store.get(key);

	if( !value )
		return Response.json(null);

	return Response.json({
		...value,
		...(
			await file.exists()
				? { content: await file.text() }
				: {}
		),
	});
}

const putToStoreEndpoint = storeName => async (req, server) => {
	if( !( await checkAuth(req, server) ) )
		return FORBIDDEN;

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
}

const deleteFromStoreEndpoint = storeName => async (req, server) => {
	if( !( await checkAuth(req, server) ) )
		return FORBIDDEN;

	const key = req.params.name;
	const store = stores[storeName];
	const filePath = join(APPDATA_DIR, 'files', storeName, key);
	const file = Bun.file(filePath);

	await store.delete(key);

	if( await file.exists() )
		await file.delete();

	return OK;
}

export default {
	'/api/ping': new Response('pong', { headers: { 'Access-Control-Allow-Origin': '*' } }),


	'/api/auth/login': {
		POST: async (req, server) => {
			if( await checkAuth(req, server) )
				return Response.json(true);

			const password = await req.json();
			const hash = await settings.get('password');

			if( await Bun.password.verify(password, hash) ){
				await authUser(req, server);
				return Response.json(true);
			}

			return Response.json(false);
		},
	},
	'/api/auth/logout': {
		GET: async (req, server) => {
			req?.cookies?.delete?.(SESSION_KEY);
			return OK;
		},
	},
	'/api/auth/check': {
		GET: async (req, server) => Response.json(
			await checkAuth(req, server)
		),
	},


	'/api/antidpi': {
		GET: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return Response.json(false);

			return Response.json(
				zapret.isStarted
			);
		},
		PUT: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;
			
			const activate = await req.json();

			if( activate )
				await zapret.start();
			else
				await zapret.stop();

			await settings.set('antidpi.active', zapret.isStarted);

			return OK;
		},
	},
	'/api/antidpi/restart': {
		POST: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			if( zapret.isStarted )
				await zapret.restart();

			return OK;
		},
	},


	'/api/server/restart': {
		POST: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			app.restart();
			return OK;
		},
	},


	'/api/profiles': {
		GET: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return Response.json([]);

			return Response.json(
				await settings.get('profiles') ?? []
			);
		},
	},
	'/api/profiles/:name': {
		GET: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return Response.json(null);

			const profiles = await settings.get('profiles') ?? [];

			return Response.json(
				profiles.find(profile => profile.name === req.params.name) ?? null
			);
		},
		PUT: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			const form = await req.json();

			if( form.syncUrl ){
				try{
					form.content = await ketchup.text(form.syncUrl);
				}
				catch(e){
					console.error(e)
				}
			}

			const profiles = await settings.get('profiles') ?? [];
			const index = profiles.findIndex(profile => profile.name === req.params.name);

			await settings.set('profiles', (
				index === -1
					? [ ...profiles, form ]
					: profiles.map((profile, i) => (
						index === i ? form : profile
					))
			));

			return OK;
		},
		DELETE: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			const profiles = await settings.get('profiles') ?? [];

			await settings.set('profiles', (
				profiles.filter(profile => profile.name !== req.params.name)
			));

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
		POST: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			const formData = await req.formData();
			const src = formData.get('file');

			if( !src )
				return new Response('Empty file', { status: 400 });

			await Bun.write(join(APPDATA_DIR, 'files', 'blobs', req.params.name), src);

			return OK;
		},
	},


	'/api/logs': {
		GET: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return new Response('');

			const logs = Bun.file(join(APPDATA_DIR, 'logs'));

			if( await logs.exists() )
				return new Response(logs);

			return new Response('');
		},
	},


	'/api/settings': {
		GET: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return Response.json({});

			const params = await settings.getAll();
			params.password = '';

			return Response.json(params);
		},
		PUT: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			const data = await req.json();

			for(const [ prop, value ] of Object.entries(data)){
				if( prop === 'password' ){
					if( value ){
						await settings.set('password', await Bun.password.hash(value));
						jwtSecret = await generateSecret('A256GCM');
					}
					
					continue;
				}

				await settings.set(prop, value);
			}

			return OK;
		},
	},
	'/api/settings/antidpi/zapret2/versions': {
		GET: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return Response.json([]);

			return Response.json(
				await zapret.getVersions()
			);
		},
	},
	'/api/settings/antidpi/zapret2/install/:version': {
		POST: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			await zapret.install(req.params.version);
			return OK;
		},
	},
	'/api/settings/reset-password': {
		POST: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			await settings.set('password', '');
			return OK;
		},
	},
	'/api/settings/reset': {
		POST: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			await settings.set('version', '0.0.0');
			
			setTimeout(() => {}, 60000);

			await app.stop();
			await Bun.sleep(3000);
			await $`rm -rf ${ APPDATA_DIR }`;
			await app.start();
			
			return OK;
		},
	},


	'/api/updater/update-now': {
		POST: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			await app.autoUpdate();
			return OK;
		},
	},


	'/api/cors-hole': {
		POST: async (req, server) => {
			if( !( await checkAuth(req, server) ) )
				return FORBIDDEN;

			const { url } = await req.json();
			
			return new Response(
				await ketchup.text(url)
			);
		},
	},
}