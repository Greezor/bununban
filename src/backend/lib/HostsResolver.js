export default class HostsResolver{
	#hosts = []

	#memory = new Map()
	#memoryLimit = 0

	#memApplyLimit()
	{
		if( this.#memoryLimit <= 0 )
			return;

		this.#memory = new Map(
			[ ...this.#memory ]
				.slice( -this.#memoryLimit )
		);
	}

	constructor(files = [], mem = 0){
		this.#hosts = files.map(path => Bun.file(path));
		this.#memoryLimit = mem;
	}

	async resolve(domain)
	{
		if( this.#memory.has(domain) ){
			const ip = this.#memory.get(domain);

			this.#memory.delete(domain);
			this.#memory.set(domain, ip);
			return ip;
		}

		for(const hosts of this.#hosts){
			if( !( await hosts.exists() ) )
				continue;

			const stream = hosts.stream();
			const decoder = new TextDecoderStream();

			let prev = '';

			for await (const chunk of stream.pipeThrough(decoder)){
				const match = ( prev + chunk ).match(new RegExp(`^(\\d+.\\d+.\\d+.\\d+)\\s+(${ domain })(\\s+|)(#.*?|)$`, 'm'));

				prev = chunk;

				if( !match )
					continue;

				const [ line, ip ] = match;

				this.#memory.set(domain, ip);
				this.#memApplyLimit();
				return ip;
			}
		}

		this.#memory.set(domain, null);
		this.#memApplyLimit();
		return null;
	}
}