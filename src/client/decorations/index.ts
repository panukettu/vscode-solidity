import * as vscode from 'vscode';
type DecorationScope = {
	pending: vscode.TextEditorDecorationType;
	fail: vscode.TextEditorDecorationType;
	success: vscode.TextEditorDecorationType;
};
export const decorationMap = new Map<string, DecorationScope>();

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

export const initDecorations = (scope: string, context: vscode.ExtensionContext) => {
	if (decorationMap.has(scope)) return;
	decorationMap.set(scope, {
		pending: pendingDecoration(context),
		fail: failDecoration(context),
		success: successDecoration(context),
	});
};

export const lineDecoration = (scope: string, text: string, line: number, type: 'pending' | 'fail' | 'success') => {
	const items = [
		{
			range: new vscode.Range(line, 0, line, 9999),
			hoverMessage: ['```sh', text, '```'].join('\n'),
		},
	];

	return vscode.window.activeTextEditor.setDecorations(decorationMap.get(scope)[type], items);
};

export const resetDecorations = (scope: string, types?: ('pending' | 'fail' | 'success')[]) => {
	const decorations = decorationMap.get(scope);
	if (types) {
		for (const type of types) vscode.window.activeTextEditor.setDecorations(decorations[type], []);
		return;
	}

	for (const value of decorationTypes) {
		vscode.window.activeTextEditor.setDecorations(decorations[value], []);
	}
};

export const removeAll = () => {
	for (const value of decorationMap.values()) {
		for (const type of decorationTypes) vscode.window.activeTextEditor.setDecorations(value[type], []);
	}
};

export const runDecorated = async <T>(promise: Promise<T>, scope: string, line: number, text = 'Running..') => {
	lineDecoration(scope, text, line, 'pending');
	try {
		const result = await promise;
		resetDecorations(scope, ['pending']);
		return result;
	} catch (err) {
		resetDecorations(scope, ['pending']);
		lineDecoration(scope, err, line, 'fail');
	}
};
