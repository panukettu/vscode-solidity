import path from "node:path"
import { Multisolc } from "@shared/compiler/multisolc"
import { mergeUnique } from "@shared/compiler/utils"
import { CompilerType } from "@shared/enums"
import { filesCache } from "@shared/project/cache"
import { Project } from "@shared/project/project"
import {
	findFirstRootProjectFile,
	findProjectFile,
	getFoundryConfig,
	loadRemappings,
} from "@shared/project/project-utils"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import type { SolidityConfig } from "@shared/types"
import packageJson from "package.json"
import * as vscode from "vscode-languageserver/node"
import { URI } from "vscode-uri"
import { connection } from "../server"
import { replaceRemappings } from "../shared/util"
import SolhintService from "./linter/solhint"
import { createServerMultisolc } from "./server-compiler"
import type { ExtendedSettings } from "./server-types"

function defaultConfig() {
	const json = packageJson.contributes.configuration.properties
	const compiler = json["solidity.compiler"].default
	// const validations = json["solidity.validation"].default
	if (typeof compiler.type === "string") {
		compiler.type = CompilerType[compiler.type]
	}
	const result = {
		compilerSettings: json["solidity.compilerSettings"].default as SolidityConfig["compilerSettings"],
		compiler: {
			...compiler,
			type: compiler.type ?? CompilerType.Extension,
		},
	} as unknown as SolidityConfig

	for (const key in json) {
		const parts = key.split(".")
		if (parts[0] !== "solidity" || parts[1].startsWith("compiler")) continue
		result[parts[1]] = json[key].default
	}

	return result
}
export const settings: ExtendedSettings = {
	hasWorkspaceFolderCapability: false,
	workspaceFolders: [],
	linter: null,
	rootPath: "",
	initialized: false,
}

let serverConfig: SolidityConfig = defaultConfig()

export function getConfig() {
	if (!serverConfig) return defaultConfig()
	return serverConfig
}

export const handleConfigChange = async (change: vscode.DidChangeConfigurationParams) => {
	filesCache.clearAll()
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
	serverConfig = newConfig

	if (serverConfig.linter.type === "solhint") {
		settings.linter = new SolhintService(settings.rootPath, serverConfig.linter.rules)
		settings.linter.setIdeRules(serverConfig.linter.rules)
	}
	await createServerMultisolc(getServerSolcSettings())
}

export function getServerSolcSettings() {
	return Multisolc.getSettings(new Project(serverConfig, settings.rootPath))
}

async function createConfig() {
	try {
		const params: vscode.ConfigurationParams = {
			items: [{ section: "solidity" }],
		}
		const results = (await connection.sendRequest("workspace/configuration", params)) as [Partial<SolidityConfig>]
		const [cfg] = results

		if (cfg.project.root && !settings.rootPath.includes(cfg.project.root)) {
			settings.rootPath = path.join(settings.rootPath, cfg.project.root)
		} else if (cfg.project.monorepo) {
			settings.rootPath = findProjectFile(settings.rootPath)
		}

		const foundry = getFoundryConfig(settings.rootPath)
		cfg.project.libs = mergeUnique(cfg.project?.libs, foundry?.profile?.libs)
		cfg.project.sources = cfg.project.sources ?? foundry?.profile?.src
		cfg.project.includePaths = mergeUnique(cfg.project?.includePaths, foundry?.profile?.include_paths)

		cfg.project.remappings = loadRemappings(
			settings.rootPath,
			cfg.project.useForgeRemappings,
			cfg.project.libs,
			replaceRemappings(cfg.project.remappings, cfg.project.remappingsWindows ?? cfg.project.remappingsUnix ?? []),
		)
		if (typeof cfg.compiler.type === "string") {
			cfg.compiler.type = CompilerType[cfg.compiler.type as string]
		}

		if (!cfg.compiler.type) {
			cfg.compiler.type = CompilerType.Extension
		}
		return cfg as SolidityConfig
	} catch (e) {
		console.debug("No config received:", e.message)
		return defaultConfig()
	}
}
