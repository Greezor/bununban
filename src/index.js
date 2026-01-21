import app from './backend/index'

app.start()

process.on('SIGINT', async () => {
	await app.stop(true);
	process.exit();
})