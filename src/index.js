import app from './backend/index'

app.start(true)

process.on('SIGINT', async () => {
	await app.stop(true);
	process.exit();
})