# Bununban 🍌

Web-panel for [bol-van/zapret2](https://github.com/bol-van/zapret2)

## Features
- zapret2 binaries downloading
- resources management (profiles, hostlists, ipsets, lua-scripts, blobs)
- resources synchronization by url
- startup shell-scripts (before/after starting/stopping zapret2)
- logs viewer

## Development

- Install dependencies:
```bash
bun install
```

- Start the development server on [http://127.0.0.1:8008](http://127.0.0.1:8008):
```bash
bun run dev
```

## Build

```bash
bun run build
```

## Usage

```bash
./dist/bununban-<platform>
```

By default uses current user homedir to store data (`$HOME/.bununban`). Launch with a specific path as homedir:
```bash
./dist/bununban-<platform> --homedir=path/to/dir
```