import * as vscode from "vscode-languageserver/node";
import { compilerType } from "../common/solcCompiler";
import { ParsedDocument } from "./code/ParsedDocument";

//DocumentExecuteCommand
export type CommandParamsBase = [{ uri: { external: string } }, any[]];
export interface SolidityConfig<T = compilerType> {
	// option for backward compatibilities, please use "linter" option instead
	linter: boolean | string;
	validateOnSave: boolean;
	validateOnChange: boolean;
	validateOnOpen: boolean;
	compileUsingLocalVersion: string;
	compileUsingRemoteVersion: string;
	compilerPackage: string;
	defaultCompiler: T;
	solhintRules: any;
	initExclude: string[];
	validationDelay: number;
	libs: string[];
	libSources: string[];
	sources: string;
	remappings: string[];
	remappingsWindows: string[];
	remappingsUnix: string[];
	monoRepoSupport: boolean;
}

export type ExtendedSettings = {
	hasWorkspaceFolderCapability: boolean;
	workspaceFolders: vscode.WorkspaceFolder[];
	linter: Linter | null;
	rootPath: string;
};

export interface Linter {
	setIdeRules(rules: any);
	validate(filePath: string, documentText: string): vscode.Diagnostic[];
	loadFileConfig(rootPath: string);
}

export type ProviderRequestHelp = {
	currentOffset: number;
	currentLine: number;
	lineText: string;
	position: vscode.Position;
	currentRange?: vscode.Range;
	selectedDocument?: ParsedDocument;
	action?: "definition" | "references" | "hover";
};

export interface CompilerError {
	diagnostic: any;
	fileName: string;
}
