const proj = Bun.file('./setup/project.evb')
const xml = await proj.text()

await Bun.write('./dist/project.evb', xml.replaceAll('{PATH}', process.cwd()))