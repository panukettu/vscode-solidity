import { execSync } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';

// @ts-expect-error
import pkg from 'glob';
const { glob } = pkg;
import { type Options, defineConfig } from 'tsup';
// const { glob } = pkg;

export default defineConfig(async (opts) => {
	return {
		entry: ['src/extension.ts', 'src/server.ts'],
		external: ['vscode', 'typescript'],
		format: 'cjs',
		outDir: './out/src',
		platform: 'node',
		sourcemap: true,
		bundle: true,
		noExternal: [
			// /(?:[^vscode]).*?([\w\-]+)/,
			'@iarna/toml',
			'axios',
			'fs-extra',
			'glob',
			'fast-equals',
			'solc',
			'solhint',
			'lodash.debounce',
			'prettier',
			'prettier-plugin-solidity',
			'solparse-exp-jb',
			'vscode-languageclient',
			'vscode-languageserver',
			'vscode-languageserver-textdocument',
			'vscode-uri',
			'yaml-js',
			'viem',
		],
		treeshake: true,
		splitting: true,
		tsconfig: './tsconfig.json',
		minify: true,
		clean: true,
		async onSuccess() {
			if (opts.watch) return;
			execSync('cp ./package.json ./out/package.json');
			execSync('cp ./node_modules/@solidity-parser/parser/dist/*.tokens ./out/src/');
			if (!existsSync('./out/src/antlr')) {
				mkdirSync('./out/src/antlr', {});
			}
			execSync('cp ./node_modules/@solidity-parser/parser/dist/antlr/*.tokens ./out/src/antlr');

			const files = [
				...glob.sync('./out/src/postcss-*.js'),
				...glob.sync('./out/src/angular-*.js'),
				...glob.sync('./out/src/flow-*.js'),
				// ...glob.sync('./out/src/typescript-*.js'),
				...glob.sync('./out/src/babel-*.js'),
			];

			console.debug('deleted', files);
			if (files.length > 0) {
				for (const file of files) {
					unlinkSync(file);
				}
			}
		},
	};
});
