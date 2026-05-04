import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { APPDATA_DIR } from './appdata'

class Store
{
	#id = null;
	#path = null;

	#store = new Map();
	#loaded = false;
	#unloadTimeout = null;

	constructor(id)
	{
		this.#id = id;
		this.#path = join(APPDATA_DIR, id);
	}

	get id()
	{
		return this.#id;
	}

	get file()
	{
		return Bun.file(this.#path);
	}

	async backup()
	{
		if( !this.#loaded )
			throw new Error('Store is unloaded');

		mkdirSync(APPDATA_DIR, { recursive: true });

		await Bun.write(this.#path, (
			JSON.stringify([
				...this.#store,
			])
		));
	}

	async load(force = false)
	{
		this.cancelSnoozedUnload();

		if( !this.#loaded || force ){
			this.#loaded = false;

			this.#store = new Map(
				await this.file.exists()
					? await this.file.json()
					: []
			);

			this.#loaded = true;
		}
	}

	unload()
	{
		this.#loaded = false;
		this.#store = new Map();
	}

	snoozeUnload(delay = 5000)
	{
		this.cancelSnoozedUnload();
		this.#unloadTimeout = setTimeout(() => this.unload(), delay);
	}

	cancelSnoozedUnload()
	{
		clearTimeout(this.#unloadTimeout);
	}

	async get(param)
	{
		await this.load();
		this.snoozeUnload();

		return this.#store.get(param);
	}

	async set(param, value)
	{
		await this.load();

		this.#store.set(param, value);
		await this.backup();

		this.snoozeUnload();
	}

	async delete(param)
	{
		await this.load();

		this.#store.delete(param);
		await this.backup();

		this.snoozeUnload();
	}

	async getAll()
	{
		await this.load();
		this.snoozeUnload();

		return Object.fromEntries(this.#store);
	}
}

export default Store