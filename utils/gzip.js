const glob = new Bun.Glob(process.argv[2]);

for await (const path of glob.scan('.')) {
	console.log(`Compressing ${ path }...`);

	const file = Bun.file(path);
	const gz = Bun.gzipSync(await file.bytes(), { level: 9 });
	await Bun.write(path + '.gz', gz);
	
	console.log('Successfully compressed.');
}