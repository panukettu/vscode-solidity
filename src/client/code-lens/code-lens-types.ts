import type { FunctionName } from '@shared/types';
import * as vscode from 'vscode';

export namespace Lens {
	export type Funcsig = readonly [vscode.TextDocument, vscode.Range];
	export type Natspec = readonly [vscode.TextDocument, vscode.Range];
	export type ForgeTestExec = readonly [FunctionName, vscode.TextDocument, vscode.Range];
}
