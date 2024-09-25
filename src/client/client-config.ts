import path from "node:path"
import * as vscode from "vscode"
import type { ContractLevelSolcOutput, SolcInput } from "../shared/compiler/types-solc"
import { CompilerType } from "../shared/enums"
import { findFirstRootProjectFile } from "../shared/project/project-utils"
import type { SolidityConfig } from "../shared/types"
import { replaceRemappings } from "../shared/util"

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class Config {
	public static getConfig() {
		return vscode.workspace.getConfiguration().get<SolidityConfig>("solidity")
	}

	public static all() {
		return { ...Config.getConfig(), ...Config.getCompiler() }
	}

	public static getCompiler() {
		const compiler = vscode.workspace.getConfiguration("solidity").get<SolidityConfig["compiler"]>("compiler")

		const compilerType =
			typeof compiler.type === "number" ? compiler.type : CompilerType[compiler.type as keyof typeof CompilerType]
		return {
			compiler: {
				...compiler,
				type: compilerType ?? CompilerType.Extension,
			},
			compilerSettings: vscode.workspace.getConfiguration("solidity").get<{
				output: ContractLevelSolcOutput[]
				input: Partial<SolcInput["settings"]>
			}>("compilerSettings"),
		}
	}
	public static getTestVerbosity() {
		return vscode.workspace.getConfiguration("solidity").get<number>("test.verbosity")
	}
	public static getDownloadsDir() {
		return vscode.workspace.getConfiguration("solidity").get<string>("project.downloads")
	}

	public static getRemappings() {
		return vscode.workspace.getConfiguration("solidity").get<string[]>("project.remappings")
	}

	public static getRemappingsWindows() {
		return vscode.workspace.getConfiguration("solidity").get<string[]>("project.remappingsWindows")
	}

	public static getRemappingsUnix(): string[] {
		return vscode.workspace.getConfiguration("solidity").get<string[]>("project.remappingsUnix")
	}

	public static getMonoRepoSupport(): boolean {
		return vscode.workspace.getConfiguration("solidity").get<boolean>("project.monorepo")
	}
	public static getWorkspaceInfo() {
		const rootOverride = vscode.workspace.getConfiguration("solidity").get<string>("project.root")
		const monoRepoSupport = Config.getMonoRepoSupport()
		return { rootOverride, monoRepoSupport }
	}
	public static shouldOpenProblemsPane(): boolean {
		return vscode.workspace.getConfiguration("solidity").get<boolean>("validation.autoOpenProblems")
	}
}

export function getRootPath() {
	const rootPath = getRootFsPath()
	if (!rootPath) throw new Error("Please open a folder in Visual Studio Code as a workspace")

	const { rootOverride, monoRepoSupport } = Config.getWorkspaceInfo()
	if (rootOverride) return path.join(rootPath, rootOverride)
	if (!monoRepoSupport) return rootPath

	return findFirstRootProjectFile(rootPath, vscode.window.activeTextEditor.document.uri.fsPath) ?? rootPath
}

function getRootFsPath() {
	const editor = vscode.window.activeTextEditor
	const currentDocument = editor.document.uri
	if (!currentDocument) return vscode.workspace.rootPath
	const workspace = vscode.workspace.getWorkspaceFolder(currentDocument)
	if (!workspace) return vscode.workspace.rootPath
	return workspace.uri.fsPath
}

export function getSolidityRemappings(): string[] {
	const remappings = Config.getRemappings()
	if (process.platform === "win32") {
		return replaceRemappings(remappings, Config.getRemappingsWindows())
	}
	return replaceRemappings(remappings, Config.getRemappingsUnix())
}
