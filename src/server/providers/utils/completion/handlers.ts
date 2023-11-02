import { relative } from "path"
import * as path from "path"
import { fileURLToPath } from "url"
import { emitDotRegexp } from "@shared/regexp"
import glob from "glob"
import * as vscode from "vscode-languageserver/node"
import { ParsedContract } from "../../../code/ParsedContract"
import { ParsedDocument } from "../../../code/ParsedDocument"
import { ParsedStruct } from "../../../code/ParsedStruct"
import { ParsedStructVariable } from "../../../code/ParsedStructVariable"
import { typeHelp } from "../../../code/utils/ParsedCodeTypeHelper"
import { DotCompletionService } from "../../../code/utils/dotCompletionService"
import { CodeWalkerService } from "../../../codewalker"
import { getFunctionsByNameOffset } from "../functions"
import {
	GeCompletionUnits,
	GetCompletionKeywords,
	GetCompletionTypes,
	GetGlobalFunctions,
	GetGlobalVariables,
} from "./globals"
import { getImportPath, textEdit } from "./misc"
import { dotStartMatchers, parsePosition } from "./textMatchers"

const getLastDot = (
	document: ParsedDocument,
	offset: number,
	triggers: ReturnType<typeof parsePosition>,
	position: vscode.Position,
	matchers: ReturnType<typeof dotStartMatchers>,
	trigger: ReturnType<typeof parsePosition>,
	indexToStart: number,
) => {
	const index = triggers.line.lastIndexOf(".", indexToStart - 1)

	let results = DotCompletionService.getSelectedDocumentDotCompletionItems(
		triggers.lines,
		position,
		index,
		document,
		offset,
		matchers.dotAfterFuncParams,
	)
	if (!results.length && index > 1) {
		results = results.concat(getLastDot(document, offset, triggers, position, matchers, trigger, index).results)
	}
	return {
		results,
		index,
	}
}
export const handleCustomFunctionCompletion = (
	document: ParsedDocument,
	offset: number,
	position: vscode.Position,
	matchers: ReturnType<typeof dotStartMatchers>,
	triggers: ReturnType<typeof parsePosition>,
) => {
	try {
		const items = getFunctionsByNameOffset(matchers.itemIdsFiltered, document, offset)
		if (!items?.length) {
			if (matchers.isReplacingCall && matchers.itemIdsFiltered?.length > 0) {
				const itemsInner = getFunctionsByNameOffset(matchers.itemIdsFiltered.slice(0, 1), document, offset)
				if (itemsInner?.length && document.selectedContract) {
					return document.selectedContract.using
						.filter((u) => {
							return u.for.name === itemsInner[0].name
						})
						.flatMap((u) => u.for.getInnerCompletionItems(true))
				}
			} else if (matchers.dotAfterFuncParams && matchers.mappingIds?.length > 0) {
				const mappingType = document.findTypeInScope(matchers.mappingId) as ParsedStructVariable
				if (!mappingType) return handleDefault(document, offset)

				const { result, isValueType } = typeHelp.mappingOutType(mappingType)

				const type = document.findTypeInScope(result)

				if (type instanceof ParsedStruct && !isValueType) {
					let [lib, member] = type.findExtendedMethodCall(
						matchers.itemIdsFiltered[matchers.itemIdsFiltered?.length - 1],
					)

					if (!member?.length && matchers.itemIdsFiltered?.length > 1) {
						;[lib, member] = type.findExtendedMethodCall(matchers.itemIdsFiltered[matchers.itemIdsFiltered?.length - 2])
					}
					if (lib?.length > 0 && member?.length > 0 && member[0].output?.length > 0 && document.selectedContract) {
						return document.selectedContract.using
							.filter((u) => {
								return u.for.name === member[0].output[0].type.name
							})
							.flatMap((u) => u.for.getInnerCompletionItems(true))
					} else {
						return getLastDot(document, offset, triggers, position, matchers, triggers, triggers.triggers.dotStart)
							.results
					}
				}
				return document.selectedContract.using
					.filter((u) => {
						return u.for.name === result
					})
					.flatMap((u) => u.for.getInnerCompletionItems(true))
			} else {
				if (matchers.dotAfterFuncParams) {
					return getLastDot(document, offset, triggers, position, matchers, triggers, triggers.triggers.dotStart)
						.results
				}
				return handleDefault(document, offset)
			}
		}

		const { relevantVars, relevantParams } = typeHelp.typesForFuncInput(
			offset,
			document.getSelectedFunction(offset),
			items[0],
		)
		if (items[0] instanceof ParsedContract) {
			const item = items[0] as ParsedContract
			if (document.selectedContract) {
				return document.selectedContract.using
					.filter((u) => {
						return u.for.name === item.name
					})
					.flatMap((u) => u.for.getInnerCompletionItems(true))
			} else {
			}
		} else {
			if (matchers.dotAfterFuncParams && items[0] && items[0].output?.length === 0) {
				return []
			}
		}

		if (matchers.dotAfterFuncParams && matchers.itemIdsFiltered?.length > 1) {
			const output = items[0].output?.length === 1 ? items[0].output[0] : null
			if (output?.type.isValueType) {
				return output.type.getInnerCompletionItems(true)
			}
		}
		let result = []
		if (!matchers.dotAfterFuncParams) {
			result = relevantVars
				.map((v) => v.createCompletionItem(true))
				.concat(relevantParams.map((v) => v.createFieldCompletionItem()))
		}

		return result.concat(
			DotCompletionService.getSelectedDocumentDotCompletionItems(
				triggers.lines,
				position,
				triggers.triggers.dotStart,
				document,
				offset,
				matchers.dotAfterFuncParams,
			),
		)
	} catch (e) {
		// console.debug(e);
		return handleDefault(document, offset)
	}
}

export const handleCustomMappingCompletion = (
	document: ParsedDocument,
	offset: number,
	position: vscode.Position,
	matchers: ReturnType<typeof dotStartMatchers>,
	triggers: ReturnType<typeof parsePosition>,
) => {
	let mappingType: ParsedStructVariable | undefined
	mappingType = document.findTypeInScope(matchers.mappingId) as ParsedStructVariable

	if (!mappingType) {
		const items = getFunctionsByNameOffset(matchers.itemIdsFiltered, document, offset)
		if (!items?.length) {
			return handleDefault(document, offset)
		}

		const innerFunc = items[0]
		mappingType = innerFunc.document.findTypeInScope(matchers.mappingId) as ParsedStructVariable
	}

	if (!mappingType) {
		return handleDefault(document, offset)
	}

	if (matchers.isMappingAccessor) {
		const { result, isValueType } = typeHelp.mappingOutType(mappingType)
		if (!isValueType) {
			const type = document.findTypeInScope(result)
			// @ts-expect-error;
			return type.getInnerCompletionItems(true)
		} else if (document.selectedContract) {
			return document.selectedContract.using
				.filter((u) => {
					return u.for.name === result
				})
				.flatMap((u) => u.for.getInnerCompletionItems(true))
		}
	}

	const { relevantVars, relevantParams } = typeHelp.typesForMappingInput(
		offset,
		document.getSelectedFunction(offset),
		mappingType,
		matchers.mappingParamIndex,
	)

	const result = relevantVars
		.map((v) => v.createCompletionItem(true))
		.concat(relevantParams.map((v) => v.createFieldCompletionItem()))

	return result.concat(
		DotCompletionService.getSelectedDocumentDotCompletionItems(
			triggers.lines,
			position,
			triggers.triggers.dotStart,
			document,
			offset,
		),
	)
}

export const handleDotEmit = (document: ParsedDocument, line: string) => {
	const emitDotResult = emitDotRegexp.exec(line)
	if (!emitDotResult?.length) return []

	const emitFrom = emitDotResult[1]
	const contract = document.findContractByName(emitFrom)
	return contract.getAllEventsCompletionItems()
}

export const handleCustomMatchers = (
	completionItems: vscode.CompletionItem[],
	matchers: ReturnType<typeof dotStartMatchers>,
) => {
	if (matchers.isReplacingCall) {
		return completionItems.map((c) => ({
			...c,
			insertText: "",
		}))
	} else if (matchers.isControlStatement) {
		return completionItems.map((c) => ({
			...c,
			insertText: c.insertText ? c.insertText.replace(";", "") : c.insertText,
		}))
	}

	return completionItems
}

export const handleInnerImportCompletion = (
	walker: CodeWalkerService,
	completionItems: vscode.CompletionItem[],
	document: vscode.TextDocument,
	line: string,
	position: vscode.Position,
	triggers: ReturnType<typeof parsePosition>["triggers"],
) => {
	completionItems = completionItems.concat(
		...walker.parsedDocumentsCache.map((d) => [
			...d.getAllGlobalContractsCompletionItems(),
			...d.getAllGlobalFunctionCompletionItems(),
			...d.getAllGlobalStructsCompletionItems(),
			...d.getAllGlobalConstantCompletionItems(),
		]),
	)

	// filter out duplicates
	completionItems = completionItems.filter(
		(item, index, self) => index === self.findIndex((t) => t.label === item.label),
	)
	const hasPreviousItems = line.indexOf(",") !== -1
	const selectionStart = {
		line: position.line,
		character: hasPreviousItems ? line.indexOf(",") + 1 : line.indexOf("{") + 1,
	}
	const selectionEnd = {
		line: position.line,
		character: triggers.from ? line.length : line.indexOf("}") + 1,
	}
	// const range = vscode.Range.create(position, lineEnd);
	const editRange = vscode.Range.create(selectionStart, selectionEnd)
	const filePath = fileURLToPath(document.uri)
	const result = completionItems.map((i) => {
		if (!i.data?.absolutePath) return i
		let rel = relative(filePath, i.data.absolutePath)
		rel = rel.split("\\").join("/")
		if (rel.startsWith("../")) {
			rel = rel.substr(1)
		}
		const prefix = hasPreviousItems ? " " : ""
		const importPath = i.data.remappedPath ?? rel
		const replaced = i.insertText.includes("(") ? i.insertText.split("(")[0] : i.insertText

		return {
			...i,
			preselect: true,
			textEdit: vscode.InsertReplaceEdit.create(`${prefix + replaced}} from "${importPath}";`, editRange, editRange),
		}
	})
	return result
}

export const handleFileSearch = (
	walker: CodeWalkerService,
	completionItems: vscode.CompletionItem[],
	document: vscode.TextDocument,
	trigs: ReturnType<typeof parsePosition>,
	position: vscode.Position,
	rootPath: string,
) => {
	const { triggers, line } = trigs
	const hasSourceDir = walker.resolvedSources !== ""
	const sourcesDir = `/${walker.resolvedSources}`
	const files = glob.sync(`${rootPath + (hasSourceDir ? sourcesDir : "")}/**/*.sol`)
	const prefix = line[position.character] === '"' ? "" : '"'
	const fromIndex = line.indexOf('from "')
	const editRange = vscode.Range.create(
		{
			...position,
			character: fromIndex !== -1 ? fromIndex + (prefix ? 5 : 6) : position.character,
		},
		{
			...position,
			character: line.length,
		},
	)

	for (const file of files) {
		const dependencies = walker.project.libs.map((x) => path.join(rootPath, x))

		const [importPath, select] = getImportPath(file, dependencies, document, walker)

		const completionItem = vscode.CompletionItem.create(importPath)
		completionItem.textEdit = textEdit(importPath, editRange, prefix)
		completionItem.kind = vscode.CompletionItemKind.File
		if (triggers.symbolId) {
			const doc = walker.parsedDocumentsCache.find((d) => d.sourceDocument.absolutePath === file)

			if (doc) {
				const symbol = doc.findItem(triggers.symbolId)
				if (symbol) {
					completionItem.preselect = true
					completionItem.detail = symbol.getContractNameOrGlobal()
					completionItem.kind = symbol.createCompletionItem().kind
					completionItem.documentation = symbol.getMarkupInfo()
				}
			}
		} else if (select) {
			completionItem.preselect = select
		}
		completionItems.push(completionItem)
	}

	return completionItems
}

export const handleEmit = (document: ParsedDocument) => {
	if (document.selectedContract != null) {
		return document.selectedContract
			.getAllEventsCompletionItems()
			.concat(document.document.getAllGlobalContractsCompletionItems())
	} else {
		return document.getAllGlobalEventsCompletionItems()
	}
}

export const handleRevert = (document: ParsedDocument) => {
	if (document.selectedContract != null) {
		return document.selectedContract.getAllErrorsCompletionItems()
	} else {
		return document.getAllGlobalErrorsCompletionItems()
	}
}

export const handleDefault = (document: ParsedDocument, offset: number) => {
	if (document.selectedContract != null) {
		return document.selectedContract.getSelectedContractCompletionItems(offset)
	} else {
		return document.getSelectedDocumentCompletionItems(offset)
	}
}

export const handleFinally = () => {
	return GetCompletionTypes()
		.concat(GetCompletionKeywords())
		.concat(GeCompletionUnits())
		.concat(GetGlobalFunctions())
		.concat(GetGlobalVariables())
}
// const mappingStartIndex = line.lastIndexOf("(");

// const allowDot = mappingStartIndex < triggeredByDotStart;

// if (allowDot) {
//   return completionItems.concat(
//     DotCompletionService.getSelectedDocumentDotCompletionItems(
//       lines,
//       position,
//       triggeredByDotStart,
//       documentContractSelected,
//       offset
//     )
//   );
// }
