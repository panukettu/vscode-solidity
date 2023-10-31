import { DecorArgs } from '@client/decorations';
import * as vscode from 'vscode';
import { CompilerType } from './enums';
import { SolcInput } from './compiler/solc-types';
import { ClientState } from '@client/client-state';

export type TestFunctionName<T extends string> = `${T}()`;

export type ForgeTestJson<T extends string = ''> = {
	duration: {
		secs: number;
		nanos: number;
	};
	test_results: {
		[key in TestFunctionName<T>]: {
			status: 'Failure' | 'Success';
			logs: any[];
			decoded_logs: string[];
			kind: {
				Standard: number;
				traces: any[];
				labeled_addresses: object;
				debug: any;
				breakpoints: any;
				warnings: any[];
			};
		};
	};
};

export interface CompilerError {
	diagnostic: any;
	fileName: string;
}

export type TestFunctionResult = {
	result?: string;
	resultDecor?: DecorArgs;
	info: string;
	isFail: boolean;
	isError: boolean;
	err: any;
};

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
	compilerPackage: string;
	rootPath: string;
	selectedType: CompilerType;
};
export type FunctionLensArgs = [vscode.TextDocument, vscode.Range];
export type TestFunctionLensArgs = [string, vscode.TextDocument, vscode.Range];

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
	compilerPackage: string;
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
