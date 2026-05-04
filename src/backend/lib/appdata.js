import { join } from 'node:path'
import argv from './argv'

export const APPDATA_DIR = join(argv.homedir, '.bununban')