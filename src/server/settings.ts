import { CompilerType } from '@shared/enums';
import type { MultisolcSettings, SolidityConfig } from '@shared/types';
import packageJson from 'package.json';
import * as vscode from 'vscode-languageserver';
import { connection } from '../server';
import { replaceRemappings } from '../shared/util';
import { createServerMultisolc } from './compiler-server';
import SolhintService from './linter/solhint';
import { SERVER_COMMANDS_LIST } from './providers/command';
import { ExtendedSettings } from './types';
function defaultConfig(): SolidityConfig {
	const result = {} as SolidityConfig;

	let defaultCompiler = CompilerType.Extension;
	for (const key in packageJson.contributes.configuration.properties) {
		const keys = key.split('.');
		if (keys.length === 2 && keys[0] === 'solidity') {
			if (key === 'solidity.compilerType') {
				defaultCompiler = CompilerType[packageJson.contributes.configuration.properties[key].default];
			} else {
				result[keys[1]] = packageJson.contributes.configuration.properties[key].default;
			}
		}
	}

	return {
		...result,
		compilerType: defaultCompiler,
	};
}
export const settings: ExtendedSettings = {
	hasWorkspaceFolderCapability: false,
	workspaceFolders: [],
	linter: null,
	rootPath: '',
};

export let config = defaultConfig();

export const handleConfigChange = async (change: vscode.DidChangeConfigurationParams) => {
	updateConfig({
		...config,
		...(await requestConfig()),
	});
};
export function handleInitialize(params: vscode.InitializeParams): vscode.InitializeResult {
	settings.rootPath = params.rootUri.replace('file://', '');
	const capabilities = params.capabilities;

	settings.hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	if (params.workspaceFolders) {
		settings.workspaceFolders = params.workspaceFolders;
	}

	const result: vscode.InitializeResult = {
		capabilities: {
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: ['.', '/', '"', "'"],
			},
			definitionProvider: true,
			referencesProvider: true,
			hoverProvider: true,
			signatureHelpProvider: {
				workDoneProgress: false,
				triggerCharacters: ['(', ','],
			},
			textDocumentSync: vscode.TextDocumentSyncKind.Full,
			executeCommandProvider: {
				commands: Object.values(SERVER_COMMANDS_LIST),
			},
		},
	};

	if (settings.hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true,
			},
		};
	}

	return result;
}
export async function handleInitialized() {
	updateConfig(await requestConfig());

	if (!settings.hasWorkspaceFolderCapability) return;

	connection.workspace.onDidChangeWorkspaceFolders((_event) => {
		if (!connection.workspace) return;
		connection.workspace.onDidChangeWorkspaceFolders((event) => {
			for (const workspaceFolder of event.removed) {
				const index = settings.workspaceFolders.findIndex((folder) => folder.uri === workspaceFolder.uri);
				if (index !== -1) {
					settings.workspaceFolders.splice(index, 1);
				}
			}
			settings.workspaceFolders.push(...event.added);
		});
	});
}

export function updateConfig(soliditySettings: SolidityConfig) {
	config = {
		...soliditySettings,
		compilerType: soliditySettings.compilerType || CompilerType.Extension,
		remappings: replaceRemappings(
			soliditySettings.remappings,
			process.platform === 'win32' ? soliditySettings.remappingsWindows : soliditySettings.remappingsUnix
		),
	};
	if (config.linter === 'solhint') {
		settings.linter = new SolhintService(settings.rootPath, config.solhintRules);
		settings.linter.setIdeRules(config.solhintRules);
	}

	createServerMultisolc(getCurrentMultisolcSettings(config));
}

export async function requestMultisolcSettings(): Promise<MultisolcSettings> {
	return getCurrentMultisolcSettings(await requestConfig());
}

export function getCurrentMultisolcSettings(_config?: SolidityConfig): MultisolcSettings {
	if (!_config) {
		_config = config;
	}
	return {
		outDir: config.outDir,
		compilerConfig: {
			settings: {
				optimizer: {
					enabled: false,
					runs: 200,
				},
			},
		},
		rootPath: settings.rootPath,
		excludePaths: config.initExclude,
		sourceDir: config.sources,
		localSolcVersion: config.localSolcVersion,
		remoteSolcVersion: config.remoteSolcVersion,
		npmSolcPackage: config.npmSolcPackage,
		selectedType: config.compilerType,
	};
}

async function requestConfig() {
	try {
		const params: vscode.ConfigurationParams = {
			items: [{ section: 'solidity' }],
		};
		const [configuration] = (await connection.sendRequest('workspace/configuration', params)) as [
			Partial<SolidityConfig>,
		];
		return {
			...configuration,
			compilerType: CompilerType[configuration.compilerType] || CompilerType.Extension,
		} as SolidityConfig;
	} catch (e) {
		console.debug('Config not received:', e.message);
		return defaultConfig();
	}
}
