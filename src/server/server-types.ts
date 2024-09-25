import type * as vscode from "vscode-languageserver/node"
import type { ParsedDocument } from "./code/ParsedDocument"

//DocumentExecuteCommand

export type CommandParamsBase = [{ uri: { external: string } }, any[]]

export type ExtendedSettings = {
	hasWorkspaceFolderCapability: boolean
	workspaceFolders: vscode.WorkspaceFolder[]
	linter: Linter | null
	rootPath: string
	initialized: boolean
}

export interface Linter {
	setIdeRules(rules: object): void
	validate(filePath: string, documentText: string): vscode.Diagnostic[]
	loadFileConfig(rootPath: string): void
}

export type ProviderRequestHelp = {
	currentOffset: number
	currentLine: number
	lineText: string
	position: vscode.Position
	currentRange?: vscode.Range
	selectedDocument?: ParsedDocument
	action?: "definition" | "references" | "hover"
}

export interface ServerCompilerDiagnostic {
	diagnostic: vscode.Diagnostic
	fileName: string
}
