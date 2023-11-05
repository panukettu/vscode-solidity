import { CompilerType } from "@shared/enums"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import type { MultisolcSettings, SolidityConfig } from "@shared/types"
import packageJson from "package.json"
import * as vscode from "vscode-languageserver/node"
import { connection } from "../server"
import { replaceRemappings } from "../shared/util"
import SolhintService from "./linter/solhint"
import { createServerMultisolc } from "./server-compiler"
import { ExtendedSettings } from "./server-types"
function defaultConfig() {
	const result = {} as SolidityConfig

	let defaultCompiler = CompilerType.Extension
	for (const key in packageJson.contributes.configuration.properties) {
		const keys = key.split(".")
		if (keys[0] === "solidity") {
			if (key === "solidity.compiler.location") {
				defaultCompiler = CompilerType[packageJson.contributes.configuration.properties[key].default]
			} else {
				result[keys[1]] = packageJson.contributes.configuration.properties[key].default
			}
		}
	}

	return {
		...result,
		compiler: {
			...result.compiler,
			location: defaultCompiler,
		},
	}
}
export const settings: ExtendedSettings = {
	hasWorkspaceFolderCapability: false,
	workspaceFolders: [],
	linter: null,
	rootPath: "",
}

export let config = defaultConfig()

export const handleConfigChange = async (change: vscode.DidChangeConfigurationParams) => {
	updateConfig({
		...config,
		...(await requestConfig()),
	})
}
export function handleInitialize(params: vscode.InitializeParams): vscode.InitializeResult {
	settings.rootPath = params.rootUri.replace("file://", "")
	const capabilities = params.capabilities
	settings.hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders)

	if (params.workspaceFolders) {
		settings.workspaceFolders = params.workspaceFolders
	}

	const result: vscode.InitializeResult = {
		capabilities: {
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: [".", "/", '"', "'"],
			},
			codeActionProvider: {
				resolveProvider: false,
				codeActionKinds: [vscode.CodeActionKind.QuickFix],
			},
			definitionProvider: true,
			referencesProvider: true,
			hoverProvider: true,
			signatureHelpProvider: {
				workDoneProgress: false,
				triggerCharacters: ["(", ","],
			},
			textDocumentSync: vscode.TextDocumentSyncKind.Full,
			executeCommandProvider: {
				commands: Object.values(SERVER_COMMANDS_LIST),
			},
		},
	}

	if (settings.hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true,
			},
		}
	}

	return result
}
export async function handleInitialized() {
	updateConfig(await requestConfig())

	if (!settings.hasWorkspaceFolderCapability) return

	connection.workspace.onDidChangeWorkspaceFolders((_event) => {
		if (!connection.workspace) return
		connection.workspace.onDidChangeWorkspaceFolders((event) => {
			for (const workspaceFolder of event.removed) {
				const index = settings.workspaceFolders.findIndex((folder) => folder.uri === workspaceFolder.uri)
				if (index !== -1) {
					settings.workspaceFolders.splice(index, 1)
				}
			}
			settings.workspaceFolders.push(...event.added)
		})
	})
}

export function updateConfig(newConfig: SolidityConfig) {
	config = {
		...newConfig,
		compiler: {
			...newConfig.compiler,
			location: newConfig.compiler.location || CompilerType.Extension,
		},
		project: {
			...newConfig.project,
			remappings: replaceRemappings(
				newConfig.project.remappings,
				process.platform === "win32" ? newConfig.project.remappingsWindows : newConfig.project.remappingsUnix,
			),
		},
	}
	if (config.linter.type === "solhint") {
		settings.linter = new SolhintService(settings.rootPath, config.linter.rules)
		settings.linter.setIdeRules(config.linter.rules)
	}

	createServerMultisolc(getCurrentMultisolcSettings(config))
}

export async function requestMultisolcSettings(): Promise<MultisolcSettings> {
	return getCurrentMultisolcSettings(await requestConfig())
}

export function getCurrentMultisolcSettings(_config?: SolidityConfig): MultisolcSettings {
	if (!_config) {
		_config = config
	}
	return {
		outDir: config.compiler.outDir,
		compilerConfig: {
			settings: {
				optimizer: {
					enabled: false,
					runs: 200,
				},
			},
		},
		rootPath: settings.rootPath,
		excludePaths: config.project.exclude,
		sourceDir: config.project.sources,
		localSolcVersion: config.compiler.version.local,
		remoteSolcVersion: config.compiler.version.remote,
		npmSolcPackage: config.compiler.version.npm,
		selectedType: config.compiler.location,
	}
}

async function requestConfig() {
	try {
		const params: vscode.ConfigurationParams = {
			items: [{ section: "solidity" }],
		}
		const [configuration] = (await connection.sendRequest("workspace/configuration", params)) as [
			Partial<SolidityConfig>,
		]
		return {
			...configuration,
			compilerType: CompilerType[configuration.compiler.location] || CompilerType.Extension,
		} as SolidityConfig
	} catch (e) {
		console.error("No config received:", e.message)
		return defaultConfig()
	}
}
