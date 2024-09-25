// import 'tsconfig-paths/register';
import { setupClientState } from "@client/client-state"
import { registerCommands, registerProviders } from "@client/commands/commands-register"
import { registerConfigSetters } from "@client/commands/commands-config"
import { registerSolcCommands } from "@client/commands/commands-solc"
import * as path from "node:path"
import * as vscode from "vscode"
import { RevealOutputChannelOn, type LanguageClientOptions } from "vscode-languageclient"
import { LanguageClient, SettingMonitor, TransportKind, type ServerOptions } from "vscode-languageclient/node"
import { openProblemsPane } from "@client/commands/diagnostics"

function server(context: vscode.ExtensionContext): LanguageClient {
	const serverModule = path.join(__dirname, "./server.js")
	const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] }

	const serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.ipc,
		},
		debug: {
			args: ["--debug"],
			module: serverModule,
			options: debugOptions,
			transport: TransportKind.ipc,
		},
	}

	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ language: "solidity", scheme: "file" },
			{ language: "solidity", scheme: "untitled" },
		],
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		workspaceFolder: vscode.workspace.workspaceFolders[0],
		synchronize: {
			// Synchronize the setting section 'solidity' to the server
			configurationSection: "solidity",

			// Notify the server about file changes to related files contain in the workspace (TODO node, linter)
			fileEvents: [
				vscode.workspace.createFileSystemWatcher(
					new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], "*solhint.json"),
				),
				vscode.workspace.createFileSystemWatcher(
					new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], "**/foundry.toml"),
				),
				vscode.workspace.createFileSystemWatcher(
					new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], "*hardhat.config.*"),
				),
			],
		},
		initializationOptions: {
			codeActionLiteralSupport: true,
			solcCachePath: context.extensionPath,
		},
	}

	const client = new LanguageClient("solidity", "Solidity Language Server", serverOptions, clientOptions)
	client.onRequest("activeTextDocument", () => {
		return vscode.window.activeTextEditor.document
	})

	client.onRequest("activeSelection", () => {
		return vscode.window.activeTextEditor.selection
	})

	client.onRequest("workspaceFolders", () => {
		return vscode.workspace.workspaceFolders
	})

	client.onRequest("openProblemsPane", () => {
		return openProblemsPane()
	})

	client.onRequest("workspaceRoot", () => {
		return vscode.workspace.workspaceFolders[0].uri.fsPath
	})

	context.subscriptions.push(new SettingMonitor(client, "solidity.lsp.enabled").start())
	return client
}

export function activate(context: vscode.ExtensionContext) {
	const state = setupClientState(context)
	state.lsp = server(context)
	registerProviders(state)
	registerSolcCommands(state)
	registerConfigSetters(state)
	registerCommands(state)
}
