import '@webui-dev/bun-webui'

const webuiPath = './node_modules/@webui-dev/bun-webui/src/webui.ts';
const webuiFile = Bun.file(webuiPath);
const webuiCode = await webuiFile.text();

await Bun.write(webuiPath, (
	webuiCode
		.replace(
			`const ffiWorker = new Worker(new URL("./ffi_worker.ts", import.meta.url).href, { type: "module" });`,
			`const ffiWorker = new Worker(process.env.NODE_ENV === 'production' ? "./node_modules/@webui-dev/bun-webui/src/ffi_worker.ts" : new URL("./ffi_worker.ts", import.meta.url).href, { type: "module" });`
		)
));

const webuiUtilsPath = './node_modules/@webui-dev/bun-webui/src/utils.ts';
const webuiUtilsFile = Bun.file(webuiUtilsPath);
const webuiUtilsCode = await webuiUtilsFile.text();

await Bun.write(webuiUtilsPath, (
	webuiUtilsCode
		.replace(
			`if (directory.startsWith("/B:/%7EBUN/") && directory.endsWith(".exe")) {`,
			`if (directory.startsWith("/B:/%7EBUN/") && (process.env.NODE_ENV === 'production' || directory.endsWith(".exe"))) {`
		)
));

console.log(`[postinstall] @webui-dev/bun-webui patched.`);

process.exit();