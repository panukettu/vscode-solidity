import { execSync } from "node:child_process"
import { CompilerType } from "@shared/enums"
import { resolveCache } from "@shared/project/project"
import { getFoundryConfig, loadRemappings } from "@shared/project/project-utils"
import { parseRemappings } from "@shared/project/remapping"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import type { MultisolcSettings, SolidityConfig } from "@shared/types"
import packageJson from "package.json"
import * as vscode from "vscode-languageserver/node"
import { connection } from "../server"
import { replaceRemappings } from "../shared/util"
import SolhintService from "./linter/solhint"
import { createServerMultisolc } from "./server-compiler"
import type { ExtendedSettings } from "./server-types"

function defaultConfig() {
	const result = {} as SolidityConfig
	let defaultCompilerType = CompilerType.Extension

	for (const key in packageJson.contributes.configuration.properties) {
		const keys = key.split(".")
		if (keys[0] === "solidity") {
			if (key === "solidity.compiler.type") {
				defaultCompilerType = +CompilerType[packageJson.contributes.configuration.properties[key].default]
			} else {
				result[keys[1]] = packageJson.contributes.configuration.properties[key].default
			}
		}
	}

	return {
		...result,
		compiler: {
			...result.compiler,
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
	await updateConfig({
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
			// semanticTokensProvider: {
			// 	full: true,
			// 	legend: {
			// 		tokenTypes: tokenTypes,
			// 		tokenModifiers: tokenModifiers,
			// 	},
			// },
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
	await updateConfig(await requestConfig())

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

export async function updateConfig(newConfig: SolidityConfig) {
	// const foundryCfg = getFoundryConfig(settings.rootPath)?.profile
	// const sources = newConfig.project.sources ?? foundryCfg?.src ?? getHardhatSourceFolder(settings.rootPath)
	// const includePaths = Array.from(new Set((config.project.includePaths ?? []).concat(foundryCfg.include_paths ?? [])))

	config = {
		...newConfig,
		project: {
			...config.project,
			...newConfig.project,
		},
	}
	if (config.linter.type === "solhint") {
		settings.linter = new SolhintService(settings.rootPath, config.linter.rules)
		settings.linter.setIdeRules(config.linter.rules)
	}

	await createServerMultisolc(getCurrentMultisolcSettings(config))
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
				...config.compilerSettings.input,
			},
		},
		rootPath: settings.rootPath,
		excludePaths: config.project.exclude,
		sourceDir: config.project.sources,
		localSolcVersion: config.compiler.local,
		remoteSolcVersion: config.compiler.remote,
		npmSolcPackage: config.compiler.npm,
		selectedType: config.compiler.type,
	}
}

async function requestConfig() {
	try {
		const params: vscode.ConfigurationParams = {
			items: [{ section: "solidity" }],
		}
		const cfg = (await connection.sendRequest("workspace/configuration", params)) as [Partial<SolidityConfig>]
		const [configuration] = cfg
		const forgetoml = getFoundryConfig(settings.rootPath)
		return {
			...configuration,
			project: {
				...configuration.project,
				sources: configuration.project.sources ?? forgetoml?.profile?.src,
				libs: Array.from(new Set((configuration.project?.libs ?? []).concat(forgetoml?.profile?.libs ?? []))),
				includePaths: Array.from(
					new Set((configuration.project?.includePaths ?? []).concat(forgetoml?.profile?.include_paths ?? [])),
				),
				remappings: loadRemappings({
					rootPath: settings.rootPath,
					cfg: {
						project: {
							...configuration.project,
							remappings: replaceRemappings(
								configuration.project.remappings,
								configuration.project.remappingsWindows ?? configuration.project.remappingsUnix ?? [],
							),
						},
					},
					foundry: getFoundryConfig(settings.rootPath),
				}),
			},
			compiler: {
				...configuration.compiler,
				type: CompilerType[configuration.compiler.type] || CompilerType.Extension,
			},
		} as SolidityConfig
	} catch (e) {
		console.debug("No config received:", e.message)
		return defaultConfig()
	}
}
