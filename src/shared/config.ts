import * as vscode from 'vscode';
import type { ContractLevelSolcOutput, SolcInput } from './compiler/solc-types';
import { CompilerType } from './enums';
import { findFirstRootProjectFile } from './project';
import type { MultisolcSettings } from './types';
import { replaceRemappings } from './util';

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class Config {
	public static getConfig(): string[] {
		return vscode.workspace.getConfiguration().get<string[]>('solidity');
	}
	public static getLibs(): { libs: string[]; libSources: string[] } {
		return {
			libs: vscode.workspace.getConfiguration('solidity').get<string[]>('libs'),
			libSources: vscode.workspace.getConfiguration('solidity').get<string[]>('libSources'),
		};
	}

	public static getSources(): string {
		return vscode.workspace.getConfiguration('solidity').get<string>('sources');
	}
	public static getOutDir(): string {
		return vscode.workspace.getConfiguration('solidity').get<string>('outDir');
	}

	public static getCompilerOptimisation(): number {
		return vscode.workspace.getConfiguration('solidity').get<number>('compilerOptimization');
	}

	public static getCompilerType(): CompilerType {
		return CompilerType[vscode.workspace.getConfiguration('solidity').get<string>('compilerType')];
	}

	public static getRemappings(): string[] {
		return vscode.workspace.getConfiguration('solidity').get<string[]>('remappings');
	}

	public static getRemappingsWindows(): string[] {
		return vscode.workspace.getConfiguration('solidity').get<string[]>('remappingsWindows');
	}

	public static getCompilerOptions(
		exclusions?: string[],
		sourceDir?: string | null,
		overrideType?: CompilerType
	): MultisolcSettings {
		const compilerSettings = vscode.workspace
			.getConfiguration('solidity')
			.get<Partial<SolcInput['settings']>>('compilerSettings');
		const outputSelection = vscode.workspace
			.getConfiguration('solidity')
			.get<ContractLevelSolcOutput[]>('compilerOutputSelection');
		compilerSettings.outputSelection
			? compilerSettings.outputSelection
			: // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
			  (compilerSettings.outputSelection = { '*': { '*': outputSelection, '': [] } });
		return {
			excludePaths: exclusions || vscode.workspace.getConfiguration('solidity').get<string[]>('initExclude'),
			rootPath: getCurrentWorkspaceRootFsPath(),
			sourceDir: sourceDir ? sourceDir : sourceDir === null ? null : Config.getSources(),
			outDir: Config.getOutDir(),
			compilerConfig: {
				language: 'Solidity',
				settings: compilerSettings,
			},
			remoteSolcVersion: vscode.workspace.getConfiguration('solidity').get<string>('remoteSolcVersion'),
			localSolcVersion: vscode.workspace.getConfiguration('solidity').get<string>('localSolcVersion'),
			npmSolcPackage: vscode.workspace.getConfiguration('solidity').get<string>('npmSolcPackage'),
			selectedType: overrideType || Config.getCompilerType(),
		};
	}

	public static getRemappingsUnix(): string[] {
		return vscode.workspace.getConfiguration('solidity').get<string[]>('remappingsUnix');
	}

	public static getMonoRepoSupport(): boolean {
		return vscode.workspace.getConfiguration('solidity').get<boolean>('monoRepoSupport');
	}
}

export function getCurrentProjectInWorkspaceRootFsPath() {
	const monoreposupport = Config.getMonoRepoSupport();
	const currentRootPath = getCurrentWorkspaceRootFsPath();
	if (monoreposupport) {
		const editor = vscode.window.activeTextEditor;
		const currentDocument = editor.document.uri;
		const projectFolder = findFirstRootProjectFile(currentRootPath, currentDocument.fsPath);
		if (projectFolder == null) {
			return currentRootPath;
		} else {
			return projectFolder;
		}
	} else {
		return currentRootPath;
	}
}

export function getCurrentWorkspaceRootFsPath() {
	return getCurrentWorkspaceRootFolder();
}

export function getCurrentWorkspaceRootFolder() {
	const editor = vscode.window.activeTextEditor;
	const currentDocument = editor.document.uri;
	if (!currentDocument) return vscode.workspace.rootPath;
	const workspace = vscode.workspace.getWorkspaceFolder(currentDocument);
	if (!workspace) return vscode.workspace.rootPath;
	return workspace.uri.fsPath;
}

export function getSolidityRemappings(): string[] {
	const remappings = Config.getRemappings();
	if (process.platform === 'win32') {
		return replaceRemappings(remappings, Config.getRemappingsWindows());
	} else {
		return replaceRemappings(remappings, Config.getRemappingsUnix());
	}
}
