import { DocUtil } from "@server/utils/text-document"
import * as vscode from "vscode-languageserver"
import { CompletionItem, CompletionItemKind } from "vscode-languageserver"
import { DotCompletionService } from "../code/utils/dotCompletionService"
import { CodeWalkerService } from "../codewalker"
import { settings } from "../server-config"
import { getGlobalKeywordCompletions } from "./utils/completion/globals"
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
} from "./utils/completion/handlers"
import { dotStartMatchers, parsePosition } from "./utils/completion/textMatchers"
export const ctx: {
	pos: ReturnType<typeof parsePosition> | null
	matchers: ReturnType<typeof dotStartMatchers> | null
} = {
	pos: null,
	matchers: null,
}

export const getCompletionItems = (
	document: vscode.TextDocument,
	position: vscode.Position,
	walker: CodeWalkerService,
) => {
	return new Promise<CompletionItem[]>((resolve) => {
		let completionItems: CompletionItem[] = []
		const docUtil = new DocUtil(document, DocUtil.positionRange(position), walker)
		const [, selectedDocument] = docUtil.getSelected()
		try {
			const offset = document.offsetAt(position)
			ctx.pos = parsePosition(document, position)
			if (ctx.pos.triggers.declaration) return []

			if (ctx.pos.triggers.dotStart > 0) {
				// console.debug('dot handler');
				try {
					ctx.matchers = dotStartMatchers(ctx.pos.line, position, ctx.pos.triggers.dotStart)
					const globals = getGlobalKeywordCompletions(ctx.pos.line, position.character - 1)
					// console.debug({ ctx });
					if (globals.length > 0) {
						// console.debug('global handler');
						completionItems = completionItems.concat(globals)
					} else if (ctx.matchers.useCustomFunctionCompletion || ctx.matchers.useCustomFuncParamsCompletion) {
						// console.debug('custom func handler');
						try {
							completionItems = completionItems.concat(handleCustomFunctionCompletion(docUtil, ctx.matchers, ctx.pos))
						} catch (e) {
							// console.debug('custom-func-completion', e.message);
						}
					} else if (ctx.matchers.useCustomMappingCompletion) {
						// console.debug('custom mapping handler');
						completionItems = completionItems.concat(handleCustomMappingCompletion(docUtil, ctx.matchers, ctx.pos))
					} else {
						if (ctx.pos.triggers.emit) {
							// console.debug('custom emit handler');
							completionItems = completionItems.concat(handleDotEmit(docUtil, ctx.pos.line))
						}
						// console.debug('dot handler');
						completionItems = completionItems.concat(
							DotCompletionService.getSelectedDocumentDotCompletionItems(
								docUtil,
								ctx.pos.lines,
								ctx.pos.triggers.dotStart,
							),
						)
					}
					// console.debug('custom ctx.matchers return');
					resolve(handleCustomMatchers(completionItems, ctx.matchers))
				} catch (e) {
					// console.debug('dot handler', e);
				}
			} else {
				// console.debug('outside dot');
				if (ctx.pos.triggers.searchFiles) {
					// console.debug('file search handler');
					resolve(handleFileSearch(docUtil, completionItems, ctx.pos, settings.rootPath))
				} else if (ctx.pos.triggers.innerImport) {
					// console.debug('inner import handler');
					try {
						resolve(
							handleInnerImportCompletion(walker, completionItems, document, ctx.pos.line, position, ctx.pos.triggers),
						)
					} catch (e) {
						// console.debug('trigger-inner-import', e);
					}
				} else if (ctx.pos.triggers.emit) {
					// console.debug('emit handler');
					completionItems = completionItems.concat(handleEmit(selectedDocument))
				} else if (ctx.pos.triggers.revert) {
					// console.debug('revert handler');
					completionItems = completionItems.concat(handleRevert(selectedDocument))
				} else {
					// console.debug('default handler');
					completionItems = completionItems.concat(handleDefault(selectedDocument, offset))
				}
			}
		} catch (e) {
			// console.debug('completion catch', e);
		} finally {
			// console.debug('finally handler');
			completionItems = completionItems.concat(handleFinally())
		}

		resolve(completionItems)
	})
}

export function CreateCompletionItem(label: string, kind: CompletionItemKind, detail: string) {
	const completionItem = CompletionItem.create(label)
	completionItem.kind = kind
	completionItem.detail = detail
	return completionItem
}
