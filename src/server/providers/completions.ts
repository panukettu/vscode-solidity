import * as vscode from 'vscode-languageserver';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { DotCompletionService } from '../code/utils/dotCompletionService';
import { CodeWalkerService } from '../code/walker/codeWalkerService';
import { settings } from '../settings';
import { getGlobalKeywordCompletions } from './utils/completion/globals';
import {
	handleCustomFunctionCompletion,
	handleCustomMappingCompletion,
	handleCustomMatchers,
	handleDefault,
	handleDotEmit,
	handleEmit,
	handleFileSearch,
	handleFinally,
	handleInnerImportCompletion,
	handleRevert,
} from './utils/completion/handlers';
import { dotStartMatchers, parsePosition } from './utils/completion/textMatchers';
export const ctx: {
	pos: ReturnType<typeof parsePosition> | null;
	matchers: ReturnType<typeof dotStartMatchers> | null;
} = {
	pos: null,
	matchers: null,
};

export const getCompletionItems = (
	document: vscode.TextDocument,
	position: vscode.Position,
	walker: CodeWalkerService
) => {
	let completionItems: CompletionItem[] = [];

	try {
		const offset = document.offsetAt(position);

		const documentContractSelected = walker.getSelectedDocumentProfiler(document, position);

		ctx.pos = parsePosition(document, position);
		if (ctx.pos.triggers.declaration) return [];

		if (ctx.pos.triggers.dotStart > 0) {
			// console.debug('dot handler');
			try {
				ctx.matchers = dotStartMatchers(ctx.pos.line, position, ctx.pos.triggers.dotStart);
				const globals = getGlobalKeywordCompletions(ctx.pos.line, position.character - 1);
				// console.debug({ ctx });
				if (globals.length > 0) {
					// console.debug('global handler');
					completionItems = completionItems.concat(globals);
				} else if (ctx.matchers.useCustomFunctionCompletion || ctx.matchers.useCustomFuncParamsCompletion) {
					// console.debug('custom func handler');
					try {
						completionItems = completionItems.concat(
							handleCustomFunctionCompletion(documentContractSelected, offset, position, ctx.matchers, ctx.pos)
						);
					} catch (e) {
						// console.debug('custom-func-completion', e.message);
					}
				} else if (ctx.matchers.useCustomMappingCompletion) {
					// console.debug('custom mapping handler');
					completionItems = completionItems.concat(
						handleCustomMappingCompletion(documentContractSelected, offset, position, ctx.matchers, ctx.pos)
					);
				} else {
					if (ctx.pos.triggers.emit) {
						// console.debug('custom emit handler');
						completionItems = completionItems.concat(handleDotEmit(documentContractSelected, ctx.pos.line));
					}
					// console.debug('dot handler');
					completionItems = completionItems.concat(
						DotCompletionService.getSelectedDocumentDotCompletionItems(
							ctx.pos.lines,
							position,
							ctx.pos.triggers.dotStart,
							documentContractSelected,
							offset
						)
					);
				}
				// console.debug('custom ctx.matchers return');
				return handleCustomMatchers(completionItems, ctx.matchers);
			} catch (e) {
				// console.debug('dot handler', e);
			}
		} else {
			// console.debug('outside dot');
			if (ctx.pos.triggers.searchFiles) {
				// console.debug('file search handler');
				return handleFileSearch(walker, completionItems, document, ctx.pos, position, settings.rootPath);
			} else if (ctx.pos.triggers.innerImport) {
				// console.debug('inner import handler');
				try {
					return handleInnerImportCompletion(
						walker,
						completionItems,
						document,
						ctx.pos.line,
						position,
						ctx.pos.triggers
					);
				} catch (e) {
					// console.debug('trigger-inner-import', e);
				}
			} else if (ctx.pos.triggers.emit) {
				// console.debug('emit handler');
				completionItems = completionItems.concat(handleEmit(documentContractSelected));
			} else if (ctx.pos.triggers.revert) {
				// console.debug('revert handler');
				completionItems = completionItems.concat(handleRevert(documentContractSelected));
			} else {
				// console.debug('default handler');
				completionItems = completionItems.concat(handleDefault(documentContractSelected, offset));
			}
		}
	} catch (e) {
		// console.debug('completion catch', e);
	} finally {
		// console.debug('finally handler');
		completionItems = completionItems.concat(handleFinally());
	}

	return completionItems;
};

export function CreateCompletionItem(label: string, kind: CompletionItemKind, detail: string) {
	const completionItem = CompletionItem.create(label);
	completionItem.kind = kind;
	completionItem.detail = detail;
	return completionItem;
}
