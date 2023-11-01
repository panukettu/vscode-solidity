import type { ClientState } from '@client/client-state';
import type { Diagnostic } from 'vscode-languageclient/node';
import type { SolcInput } from './compiler/solc-types';
import type { CompilerType } from './enums';

export type MinimalURI = { toString(skipEncoding?: boolean): string };
export type FunctionName<N extends string = string, A extends string = string> = `${N}(${A})`;

type URI = string;
type Scope = string;
export type ScopedURI = `${Scope}-${URI}`;

export type CompileArgs = {
	solcInput: SolcInput;
	state: ClientState;
	options: MultisolcSettings;
	contractPath?: string;
	solcType?: CompilerType;
};
export type InitializationOptions = {
	solcCachePath: string;
};

export type MultisolcSettings = {
	outDir: string;
	sourceDir?: string;
	excludePaths?: string[];
	localSolcVersion: string;
	remoteSolcVersion: string;
	compilerConfig?: Partial<SolcInput>;
	npmSolcPackage: string;
	rootPath: string;
	selectedType: CompilerType;
};

export interface ErrorWarningCounts {
	errors: number;
	warnings: number;
}

export interface SolidityConfig {
	// option for backward compatibilities, please use "linter" option instead
	linter: boolean | string;
	validateOnSave: boolean;
	validateOnChange: boolean;
	validateOnOpen: boolean;
	localSolcVersion: string;
	remoteSolcVersion: string;
	npmSolcPackage: string;
	compilerType: CompilerType;
	solhintRules: object;
	initExclude: string[];
	outDir: string;
	validationDelay: number;
	libs: string[];
	libSources: string[];
	sources: string;
	remappings: string[];
	remappingsWindows: string[];
	remappingsUnix: string[];
	monoRepoSupport: boolean;
}

export interface DiagnosticWithFileName {
	diagnostic: Diagnostic;
	fileName: string;
}
