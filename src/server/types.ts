import * as vscode from 'vscode-languageserver/node';
import { ParsedDocument } from './code/ParsedDocument';

//DocumentExecuteCommand

export type CommandParamsBase = [{ uri: { external: string } }, any[]];

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
	action?: 'definition' | 'references' | 'hover';
};
