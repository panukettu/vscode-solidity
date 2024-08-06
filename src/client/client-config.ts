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

	public static getProject() {
		return vscode.workspace.getConfiguration("solidity").get<SolidityConfig["project"]>("project")
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
	public static getOutDir() {
		return vscode.workspace.getConfiguration("solidity").get<string>("compiler.outDir")
	}

	public static getCompilerType(): CompilerType {
		return CompilerType[vscode.workspace.getConfiguration("solidity").get<string>("compiler.type")]
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
}

export function getCurrentProjectInWorkspaceRootFsPath() {
	const isMono = Config.getMonoRepoSupport()
	const rootPath = getRootFsPath()
	if (!isMono) return rootPath

	return findFirstRootProjectFile(rootPath, vscode.window.activeTextEditor.document.uri.fsPath) ?? rootPath
}

export function getRootFsPath() {
	return getCurrentWorkspaceRootFolder()
}

export function getCurrentWorkspaceRootFolder() {
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
