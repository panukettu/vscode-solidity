import { ClientState } from '@client/client-state';
import type { DecorArgs } from '@client/types';
import * as vscode from 'vscode';

const decorationTypes = ['pending', 'fail', 'success'] as const;

const successDecoration = (context: vscode.ExtensionContext) =>
	vscode.window.createTextEditorDecorationType({
		after: {
			contentIconPath: context.asAbsolutePath('assets/success.svg'),
			width: '12px',
			height: '12px',
			textDecoration: 'none; margin-left: 5px; vertical-align: text-top;',
		},
	});
const pendingDecoration = (context: vscode.ExtensionContext) =>
	vscode.window.createTextEditorDecorationType({
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
		after: {
			contentIconPath: context.asAbsolutePath('assets/working.svg'),
			width: '12px',
			height: '12px',
			textDecoration: 'none; margin-left: 5px; vertical-align: text-top;',
		},
	});

const failDecoration = (context: vscode.ExtensionContext) =>
	vscode.window.createTextEditorDecorationType({
		after: {
			contentIconPath: context.asAbsolutePath('assets/fail.svg'),
			width: '12px',
			height: '12px',
			textDecoration: 'none; margin-left: 5px; vertical-align: text-top;',
		},
	});

export const initDecorations = (state: ClientState, scope: string) => {
	if (state.decorations.has(scope)) return;
	state.decorations.set(scope, {
		pending: pendingDecoration(state.context),
		fail: failDecoration(state.context),
		success: successDecoration(state.context),
	});
};

export const lineDecoration = (state: ClientState, args: DecorArgs) => {
	const { scope, text, line, type } = args;
	const items = [
		{
			range: new vscode.Range(line, 0, line, 9999),
			hoverMessage: ['```sh', text, '```'].join('\n'),
		},
	];

	return vscode.window.activeTextEditor.setDecorations(state.decorations.get(scope)[type], items);
};

export const resetDecorations = (state: ClientState, scope: string, types?: ('pending' | 'fail' | 'success')[]) => {
	const decorations = state.decorations.get(scope);
	if (types) {
		for (const type of types) vscode.window.activeTextEditor.setDecorations(decorations[type], []);
		return;
	}

	for (const value of decorationTypes) {
		vscode.window.activeTextEditor.setDecorations(decorations[value], []);
	}
};

export const removeAllDecorations = (state: ClientState) => {
	for (const value of state.decorations.values()) {
		for (const type of decorationTypes) vscode.window.activeTextEditor.setDecorations(value[type], []);
	}
};
type RunArgs<T> = {
	promise: Promise<T>;
	scope: string;
	line: number;
};
export const runDecorated = async <T>(state: ClientState, args: RunArgs<T>, text = 'Executing..') => {
	const { promise, scope, line } = args;
	lineDecoration(state, { scope, text, line, type: 'pending' });
	try {
		const result = await promise;
		resetDecorations(state, scope, ['pending']);
		return result;
	} catch (err) {
		resetDecorations(state, scope, ['pending']);
		// lineDecoration(state, { scope, text: err.message, line, type: 'fail' });
	}
};
