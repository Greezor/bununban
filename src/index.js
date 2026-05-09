import app from './backend/index'

app.start(true);

const exit = async () => {
	await app.stop(true);
	process.exit(0);
}

process.on('beforeExit', exit);

process.on('SIGINT', exit);
process.on('SIGTERM', exit);
process.on('SIGBREAK', exit);
process.on('SIGHUP', exit);

process.stdin?.setRawMode?.(true);
process.stdin?.resume?.();
process.stdin?.setEncoding?.('utf8');

process.stdin?.on?.('data', async key => {
	if( key === 'q' || key === '\u0003' ){
		await exit();
	}
});