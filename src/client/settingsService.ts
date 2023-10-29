import * as vscode from 'vscode';
import { CompilerType } from '../common/solcCompiler';

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class SettingsService {
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

	public static getRemappingsUnix(): string[] {
		return vscode.workspace.getConfiguration('solidity').get<string[]>('remappingsUnix');
	}

	public static getMonoRepoSupport(): boolean {
		return vscode.workspace.getConfiguration('solidity').get<boolean>('monoRepoSupport');
	}
}
