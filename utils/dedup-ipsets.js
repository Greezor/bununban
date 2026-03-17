const glob = new Bun.Glob(process.argv[2]);

console.log(`Deduping...`);

for await (const path of glob.scan('.')) {
	const file = Bun.file(path);
	const text = await file.text();
	const lines = text.split('\n');

	const cidrToInt = cidr => cidr.split('/')[0].split('.').reduce((accu, octet) => (accu << 8) + parseInt(octet)) >>> 0;

	await Bun.write(path, (
		lines
			.filter((line, i, arr) => arr.indexOf(line) === i)
			.sort((a, b) => cidrToInt(a) - cidrToInt(b))
			.join('\n')
	));
}

console.log('Done!');