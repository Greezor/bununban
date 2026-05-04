import { homedir } from 'node:os'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
	args: Bun.argv,
	strict: false,
	options: {
		homedir: {
			type: 'string',
			default: homedir(),
		},
	},
})

export default values