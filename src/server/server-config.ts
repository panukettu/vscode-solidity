import { Multisolc } from "@shared/compiler/multisolc"
import { CompilerType } from "@shared/enums"
import { Project } from "@shared/project/project"
import { getFoundryConfig, loadRemappings } from "@shared/project/project-utils"
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

	return result
}
export const settings: ExtendedSettings = {
	hasWorkspaceFolderCapability: false,
	workspaceFolders: [],
	linter: null,
	rootPath: "",
}

let serverConfig: SolidityConfig = defaultConfig()

export function getConfig() {
	if (!serverConfig) return defaultConfig()
	return serverConfig
}

export const handleConfigChange = async (change: vscode.DidChangeConfigurationParams) => {
	await updateConfig({
		...serverConfig,
		...(await createConfig()),
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
	await updateConfig(await createConfig())

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

	serverConfig = newConfig
	if (serverConfig.linter.type === "solhint") {
		settings.linter = new SolhintService(settings.rootPath, serverConfig.linter.rules)
		settings.linter.setIdeRules(serverConfig.linter.rules)
	}

	await createServerMultisolc(getServerSolcSettings())
}

export function getServerSolcSettings(): MultisolcSettings {
	return Multisolc.getSettings(new Project(serverConfig, settings.rootPath))
}

async function createConfig() {
	try {
		const params: vscode.ConfigurationParams = {
			items: [{ section: "solidity" }],
		}
		const [cfg] = (await connection.sendRequest("workspace/configuration", params)) as [Partial<SolidityConfig>]

		const foundry = getFoundryConfig(settings.rootPath)
		cfg.project.libs = merge(cfg.project?.libs, foundry?.profile?.libs)
		cfg.project.sources = cfg.project.sources ?? foundry?.profile?.src
		cfg.project.includePaths = merge(cfg.project?.includePaths, foundry?.profile?.include_paths)

		cfg.project.remappings = replaceRemappings(
			cfg.project.remappings,
			cfg.project.remappingsWindows ?? cfg.project.remappingsUnix ?? [],
		)
		cfg.project.remappings = loadRemappings({
			rootPath: settings.rootPath,
			cfg,
			foundry,
		})

		cfg.compiler.type = CompilerType[cfg.compiler.type as unknown as string] || CompilerType.Extension
		return cfg as SolidityConfig
	} catch (e) {
		console.debug("No config received:", e.message)
		return defaultConfig()
	}
}

function merge<T>(a: T[] = [], b: T[] = []): T[] {
	return Array.from(new Set(a.concat(b)))
}
