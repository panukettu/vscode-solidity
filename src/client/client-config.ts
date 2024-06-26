import * as vscode from "vscode"
import type { ContractLevelSolcOutput, SolcInput } from "../shared/compiler/types-solc"
import { CompilerType } from "../shared/enums"
import { findFirstRootProjectFile } from "../shared/project/project-utils"
import type { MultisolcSettings, SolidityConfig } from "../shared/types"
import { replaceRemappings } from "../shared/util"

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class Config {
	public static getConfig() {
		return vscode.workspace.getConfiguration().get<SolidityConfig>("solidity")
	}

	public static getFullConfig() {
		return { ...Config.getConfig(), ...Config.getCompiler() }
	}

	public static getProject() {
		return vscode.workspace.getConfiguration("solidity").get<{
			excludes: string[]
			sources: string
			libs: string[]
			libSources: string[]
			remappings: string[]
			remappingsWindows: string[]
			remappingsUnix: string[]
			monorepo: boolean
		}>("project")
	}
	public static getCompiler() {
		const _compiler = vscode.workspace.getConfiguration("solidity").get<{
			outDir: string
			npm: string
			remote: string
			local: string
			type: CompilerType
		}>("compiler")
		const _compilerSettings = vscode.workspace.getConfiguration("solidity").get<{
			output: ContractLevelSolcOutput[]
			input: Partial<SolcInput["settings"]>
		}>("compilerSettings")

		return {
			compiler: _compiler,
			compilerSettings: _compilerSettings,
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

	public static getCompilerOptions(
		exclusions?: string[],
		sourceDir?: string | null,
		overrideType?: CompilerType,
	): MultisolcSettings {
		const cfg = Config.getCompiler()
		cfg.compilerSettings.input.outputSelection
			? cfg.compilerSettings.input.outputSelection
			: (cfg.compilerSettings.input.outputSelection = {
					"*": { "*": cfg.compilerSettings.output, "": [] },
			  })
		const project = Config.getProject()

		return {
			excludePaths: exclusions || project.excludes,
			rootPath: getCurrentWorkspaceRootFsPath(),
			sourceDir: sourceDir ? sourceDir : sourceDir === null ? null : Config.getProject().sources,
			outDir: Config.getOutDir(),
			compilerConfig: {
				language: "Solidity",
				settings: cfg.compilerSettings.input,
			},
			remoteSolcVersion: cfg.compiler.remote,
			localSolcVersion: cfg.compiler.local,
			npmSolcPackage: cfg.compiler.npm,
			selectedType: overrideType || cfg.compiler.type,
		}
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
	const monoreposupport = Config.getMonoRepoSupport()
	const currentRootPath = getCurrentWorkspaceRootFsPath()
	if (monoreposupport) {
		const editor = vscode.window.activeTextEditor
		const currentDocument = editor.document.uri
		const projectFolder = findFirstRootProjectFile(currentRootPath, currentDocument.fsPath)
		if (projectFolder == null) {
			return currentRootPath
		} else {
			return projectFolder
		}
	} else {
		return currentRootPath
	}
}

export function getCurrentWorkspaceRootFsPath() {
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
	} else {
		return replaceRemappings(remappings, Config.getRemappingsUnix())
	}
}
