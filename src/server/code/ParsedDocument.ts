import { CompletionItem, Hover, Location, Range, TextDocument } from "vscode-languageserver"
import { URI } from "vscode-uri"
import { SourceDocument } from "../../shared/project/sourceDocument"
import { documentMap } from "../providers/utils/caches"
import { TypeReference } from "../search/TypeReference"
import { IParsedExpressionContainer } from "./IParsedExpressionContainer"
import { ParsedCode } from "./ParsedCode"
import { ParsedConstant } from "./ParsedConstant"
import { ParsedContract } from "./ParsedContract"
import { ParsedCustomType } from "./ParsedCustomType"
import { ParsedDeclarationType } from "./ParsedDeclarationType"
import { ParsedEnum } from "./ParsedEnum"
import { ParsedError } from "./ParsedError"
import { ParsedEvent } from "./ParsedEvent"
import { ParsedExpression } from "./ParsedExpression"
import { ParsedFunction } from "./ParsedFunction"
import { ParsedImport } from "./ParsedImport"
import { ParsedStruct } from "./ParsedStruct"
import { ParsedUsing } from "./ParsedUsing"
import { Element } from "./types"

type ParsedType = ParsedContract | ParsedFunction | ParsedStruct | ParsedCode

export class ParsedDocument extends ParsedCode implements IParsedExpressionContainer {
	public selectedItem: ParsedCode | undefined
	public innerContracts: ParsedContract[] = []
	public functions: ParsedFunction[] = []
	public events: ParsedEvent[] = []
	public enums: ParsedEnum[] = []
	public usings: ParsedUsing[] = []
	public structs: ParsedStruct[] = []
	public importedDocuments: ParsedDocument[] = []
	public imports: ParsedImport[] = []

	public errors: ParsedError[] = []
	public constants: ParsedConstant[] = []
	public customTypes: ParsedCustomType[] = []
	public expressions: ParsedExpression[] = []

	public selectedFunction: ParsedFunction
	public selectedContract: ParsedContract
	public selectedEvent: ParsedEvent
	public selectedEnum: ParsedEnum
	public selectedStruct: ParsedStruct
	public selectedUsing: ParsedUsing
	public selectedImport: ParsedImport
	public selectedError: ParsedError
	public selectedConstant: ParsedConstant
	public selectedElement: Element | null = null

	public sourceDocument: SourceDocument
	public fixedSource: string
	public declare element: Element

	public getDocumentsThatReference(document?: ParsedDocument): ParsedDocument[] {
		let returnItems: ParsedDocument[] = []

		const id = this.sourceDocument.absolutePath.concat(document.sourceDocument.absolutePath)
		const id2 = document.sourceDocument.absolutePath.concat(this.sourceDocument.absolutePath)

		if (
			this.isTheSame(document) ||
			this.sourceDocument.absolutePath === document.sourceDocument.absolutePath // it is the doc so needs be added as a flag for the reference return it later on can be filtered dup
		) {
			returnItems.push(this)

			return returnItems
		}

		if (documentMap.has(id) || documentMap.has(id2)) {
			return returnItems
		}
		documentMap.set(id, true)
		documentMap.set(id2, true)

		for (const item of this.imports) {
			returnItems = returnItems.concat(item.getDocumentsThatReference(document))
		}

		if (returnItems.length > 0) {
			// if any our our imports has the document import we are also referencing it
			returnItems.push(this)
		}
		return returnItems
	}

	public addImportedDocument(document: ParsedDocument) {
		if (!this.importedDocuments.includes(document) && this !== document) {
			this.importedDocuments.push(document)
		}
	}

	public getAllSemanticTokens() {
		const results: ReturnType<typeof this.getSemanticToken> = []
		const allItems: ParsedCode[] = []
		allItems.push(...this.innerContracts)

		for (const func of this.functions) {
			results.push(...func.getSemanticToken("function.free"))
		}
		for (const err of this.errors) {
			results.push(...err.getSemanticToken("error.declaration.free"))
		}
		for (const event of this.events) {
			results.push(...event.getSemanticToken("event.declaration.free"))
		}
		for (const enm of this.enums) {
			results.push(...enm.getSemanticToken("enum.declaration.free"))
		}
		for (const struct of this.structs) {
			results.push(...struct.getSemanticToken("struct.declaration.free"))
		}
		for (const constant of this.constants) {
			results.push(...constant.getSemanticToken("constant.declaration.free"))
		}

		allItems.push(...this.usings)
		allItems.push(...this.customTypes)
		allItems.push(...this.imports)
		allItems.push(...this.expressions)

		for (const item of allItems) {
			results.push(...item.getSemanticToken())
		}
		const items = this.functions.flatMap((f) => f.getAllSemanticTokens())
		const innerContractItems = this.innerContracts.flatMap((c) => c.getAllSemanticTokens())
		const structItems = this.structs.flatMap((s) => s.getPropertySemanticTokens())
		results.push(...items)
		results.push(...innerContractItems)
		results.push(...structItems)

		return results
	}

	public getAllImportables() {
		const returnItems: ParsedCode[] = []
		returnItems.push(...this.innerContracts)
		returnItems.push(...this.functions)
		returnItems.push(...this.structs)
		returnItems.push(...this.errors)
		returnItems.push(...this.events)
		returnItems.push(...this.enums)
		returnItems.push(...this.constants)
		returnItems.push(...this.customTypes)
		returnItems.push(...this.expressions)
		return returnItems
	}

	public getAllContracts(extend = false): ParsedContract[] {
		let returnItems: ParsedContract[] = []

		returnItems = returnItems.concat(this.innerContracts)
		if (extend) {
			returnItems = returnItems.concat(this.innerContracts.flatMap((c) => c.getExtendedContractsRecursive()))
		}
		for (const item of this.importedDocuments) {
			returnItems = returnItems.concat(item.innerContracts)
			if (extend) {
				returnItems = returnItems.concat(item.getAllContracts(false))
				returnItems = returnItems.concat(item.innerContracts.flatMap((c) => c.getExtendedContractsRecursive()))
			}
		}
		const onlyUniques = returnItems.filter((v, i) => {
			return returnItems.map((mapObj) => mapObj.name).indexOf(v.name) === i
		})
		return onlyUniques
	}

	public getAllGlobalFunctions(includeExtendedMethods = false): ParsedFunction[] {
		let returnItems: ParsedFunction[] = []
		returnItems = returnItems.concat(this.functions)

		for (const item of this.importedDocuments) {
			returnItems = this.mergeArrays(returnItems, item.functions)
		}
		if (includeExtendedMethods) {
			returnItems = this.mergeArrays(
				returnItems,
				returnItems
					.filter((f) => f.output.length > 0)
					.flatMap(
						(f) =>
							f.output
								.filter((o) => !o.type.isValueType)
								.flatMap((o) => o.type.getExtendedMethodCallsFromUsing()) as ParsedFunction[],
					),
			)
		}
		return returnItems
	}

	public getAllGlobalErrors(): ParsedError[] {
		let returnItems: ParsedError[] = []
		returnItems = returnItems.concat(this.errors)

		for (const item of this.importedDocuments) {
			returnItems = this.mergeArrays(returnItems, item.errors)
		}
		return returnItems
	}

	public getAllGlobalStructs(): ParsedStruct[] {
		let returnItems: ParsedStruct[] = []
		returnItems = returnItems.concat(this.structs)

		for (const item of this.importedDocuments) {
			returnItems = this.mergeArrays(returnItems, item.structs)
		}
		return returnItems
	}

	public getAllGlobalEnums(): ParsedEnum[] {
		let returnItems: ParsedEnum[] = []
		returnItems = returnItems.concat(this.enums)

		for (const item of this.innerContracts) {
			returnItems = this.mergeArrays(returnItems, item.enums)
		}

		for (const item of this.importedDocuments) {
			returnItems = this.mergeArrays(returnItems, item.enums)
		}
		return returnItems
	}

	public getAllGlobalConstants(): ParsedConstant[] {
		let returnItems: ParsedConstant[] = []
		returnItems = returnItems.concat(this.constants)

		for (const item of this.importedDocuments) {
			returnItems = this.mergeArrays(returnItems, item.constants)
		}
		return returnItems
	}

	public getAllGlobalEvents(): ParsedEvent[] {
		let returnItems: ParsedEvent[] = []
		returnItems = returnItems.concat(this.events)

		for (const item of this.importedDocuments) {
			returnItems = this.mergeArrays(returnItems, item.events)
		}
		return returnItems
	}

	public getAllGlobalCustomTypes(): ParsedCustomType[] {
		let returnItems: ParsedCustomType[] = []
		returnItems = returnItems.concat(this.customTypes)

		for (const item of this.importedDocuments) {
			returnItems = returnItems.concat(item.customTypes)
		}
		return returnItems
	}

	public static getAllGlobalUsing(document: ParsedDocument, type: ParsedDeclarationType): ParsedUsing[] {
		const returnItems: ParsedUsing[] = [...document.usings]
		for (const imported of document.importedDocuments) {
			if (imported.usings.length > 0) {
				returnItems.push(...imported.usings)
			}
			for (const item of imported.getAllContracts()) {
				if (item.using.length > 0) {
					returnItems.push(...item.using)
				}
			}
		}

		const result = returnItems
			.filter((x) => {
				if (x.forStar === true) {
					return true
				}
				if (x.for != null) {
					let validTypeName = false
					if (x.for.name === type.name || (type.name === "address_payable" && x.for.name === "address")) {
						validTypeName = true
					}
					return x.for.isArray === type.isArray && validTypeName && x.for.isMapping === type.isMapping
				}
				return false
			})
			.filter((v, i, a) => {
				return a.map((mapObj) => mapObj.name).indexOf(v.name) === i
			})

		return result
	}

	public static getAllReferences(document: ParsedDocument, type: ParsedDeclarationType): ParsedUsing[] {
		const returnItems: ParsedUsing[] = [...document.usings]
		for (const imported of document.importedDocuments) {
			if (imported.usings.length > 0) {
				returnItems.push(...imported.usings)
			}
			for (const item of imported.getAllContracts()) {
				if (item.using.length > 0) {
					returnItems.push(...item.using)
				}
			}
		}

		return returnItems
			.filter((x) => {
				if (x.forStar === true) {
					return true
				}
				if (x.for != null) {
					let validTypeName = false
					if (x.for.name === type.name || (type.name === "address_payable" && x.for.name === "address")) {
						validTypeName = true
					}
					return x.for.isArray === type.isArray && validTypeName && x.for.isMapping === type.isMapping
				}
				return false
			})
			.filter((v, i) => {
				return returnItems.map((mapObj) => mapObj.name).indexOf(v.name) === i
			})
	}

	public initialiseDocumentReferences(documents: ParsedDocument[]) {
		this.importedDocuments = []

		for (const item of this.imports) {
			item.initialiseDocumentReference(documents)
		}
		for (const item of this.innerContracts) {
			item.initialiseExtendContracts()
		}
	}
	public initCache(offset: number) {
		this.selectedElement = this.findElementByOffset(this.element.body, offset)
		this.initializeMembers(true)
	}
	public initialiseDocument(
		documentElement: Element,
		selectedElement: Element,
		sourceDocument: SourceDocument,
		fixedSource?: string,
	) {
		this.element = documentElement
		this.sourceDocument = sourceDocument
		this.document = this
		this.fixedSource = fixedSource
		this.selectedElement = selectedElement

		this.initializeMembers(false)
	}

	private initializeMembers(reset?: boolean) {
		if (reset) {
			this.innerContracts = []
			this.functions = []
			this.imports = []
			this.events = []
			this.enums = []
			this.customTypes = []
			this.expressions = []
			this.expressions = []
			this.structs = []
			this.usings = []
			this.functions = []
			this.errors = []
			this.constants = []
		}
		if (this.element != null) {
			this.initialiseVariablesMembersEtc(this.element, null, null)
		}
		for (const element of this.element.body) {
			if (
				element.type === "ContractStatement" ||
				element.type === "LibraryStatement" ||
				element.type === "InterfaceStatement"
			) {
				const contract = new ParsedContract()
				contract.initialise(element, this)
				if (this.matchesElement(this.selectedElement, element)) {
					this.selectedContract = contract
				}

				this.innerContracts.push(contract)
			}

			if (element.type === "FileLevelConstant") {
				const constant = new ParsedConstant()
				constant.initialise(element, this)
				if (this.matchesElement(this.selectedElement, element)) {
					this.selectedConstant = constant
				}
				this.constants.push(constant)
			}

			if (element.type === "ImportStatement") {
				const importDocument = new ParsedImport()
				importDocument.initialise(element, this)

				if (this.matchesElement(this.selectedElement, element)) {
					this.selectedImport = importDocument
				}
				this.imports.push(importDocument)
			}

			if (element.type === "FunctionDeclaration") {
				const functionDocument = new ParsedFunction()
				functionDocument.initialise(element, this, null, true)

				if (this.matchesElement(this.selectedElement, element)) {
					this.selectedFunction = functionDocument
				}
				this.functions.push(functionDocument)
			}

			if (element.type === "ModifierDeclaration") {
				const functionDocument = new ParsedFunction()
				functionDocument.initialise(element, this, null, true)
				functionDocument.isModifier = true
				if (this.matchesElement(this.selectedElement, element)) {
					this.selectedFunction = functionDocument
				}
				this.functions.push(functionDocument)
			}

			if (element.type === "EventDeclaration") {
				const eventDocument = new ParsedEvent()
				eventDocument.initialise(element, this, null, true)
				if (this.matchesElement(this.selectedElement, element)) {
					this.selectedEvent = eventDocument
				}
				this.events.push(eventDocument)
			}

			if (element.type === "EnumDeclaration") {
				const enumDocument = new ParsedEnum()
				enumDocument.initialise(element, this, null, true)
				if (this.matchesElement(this.selectedElement, element)) {
					this.selectedEnum = enumDocument
				}
				this.enums.push(enumDocument)
			}

			if (element.type === "StructDeclaration") {
				const struct = new ParsedStruct()
				struct.initialise(element, this, null, true)
				if (this.matchesElement(this.selectedElement, element)) {
					this.selectedStruct = struct
				}
				this.structs.push(struct)
			}

			if (element.type === "TypeDeclaration") {
				const customType = new ParsedCustomType()
				customType.initialise(element, this, null, true)
				this.customTypes.push(customType)
			}

			if (element.type === "ErrorDeclaration") {
				const documentError = new ParsedError()
				documentError.initialise(element, this, null, true)
				if (this.matchesElement(this.selectedElement, element)) {
					this.selectedError = documentError
				}
				this.errors.push(documentError)
			}

			if (element.type === "UsingStatement") {
				const using = new ParsedUsing()
				using.initialise(element, this, null, true)
				if (this.matchesElement(this.selectedElement, element)) {
					this.selectedUsing = using
				}
				this.usings.push(using)
			}
		}
	}

	public getImportedSymbols() {
		return this.sourceDocument.imports.flatMap((x) => x.symbols)
	}

	public findContractByName(name: string): ParsedContract {
		for (const contract of this.getAllContracts()) {
			if (contract.name === name) {
				return contract
			}
		}
		return null
	}

	public override getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): TypeReference[] {
		let results: TypeReference[] = []

		if (this.isCurrentElementedSelected(offset)) {
			for (const importItem of this.imports) {
				results = results.concat(importItem.getAllReferencesToSelected(offset, documents))
			}

			for (const item of this.innerContracts) {
				results = results.concat(item.getAllReferencesToSelected(offset, documents))
			}

			for (const using of this.usings) {
				results = results.concat(using.getAllReferencesToSelected(offset, documents))
			}

			for (const func of this.functions) {
				results = results.concat(func.getAllReferencesToSelected(offset, documents))
			}

			for (const struct of this.structs) {
				results = results.concat(struct.getAllReferencesToSelected(offset, documents))
			}

			for (const error of this.errors) {
				results = results.concat(error.getAllReferencesToSelected(offset, documents))
			}

			for (const event of this.events) {
				results = results.concat(event.getAllReferencesToSelected(offset, documents))
			}

			for (const customType of this.customTypes) {
				results = results.concat(customType.getAllReferencesToSelected(offset, documents))
			}

			for (const constant of this.constants) {
				results = results.concat(constant.getAllReferencesToSelected(offset, documents))
			}

			for (const expression of this.expressions) {
				results = results.concat(expression.getAllReferencesToSelected(offset, documents))
			}

			// for (const imported of this.importedDocuments) {
			// 	results = results.concat(imported.getAllReferencesToSelected(offset, documents));
			// }

			// this.functions.forEach((x) => (results = results.concat(x.getAllReferencesToSelected(offset, documents))));
			// this.innerContracts.forEach((x) => (results = results.concat(x.getAllReferencesToSelected(offset, documents))));

			// this.errors.forEach((x) => (results = results.concat(x.getAllReferencesToSelected(offset, documents))));
			// this.events.forEach((x) => (results = results.concat(x.getAllReferencesToSelected(offset, documents))));
			// this.structs.forEach((x) => (results = results.concat(x.getAllReferencesToSelected(offset, documents))));
			// this.usings.forEach((x) => (results = results.concat(x.getAllReferencesToSelected(offset, documents))));
			// this.customTypes.forEach((x) => (results = results.concat(x.getAllReferencesToSelected(offset, documents))));
			// this.constants.forEach((x) => (results = results.concat(x.getAllReferencesToSelected(offset, documents))));
			// this.imports.forEach((x) => (results = results.concat(x.getAllReferencesToSelected(offset, documents))));
			// this.expressions.forEach((x) => (results = results.concat(x.getAllReferencesToSelected(offset, documents))));

			// const structMembers = this.structs
			//   .map((s) => s.getInnerMembers())
			//   .flatMap((s) => s);

			// const functionMembers = this.getAllGlobalFunctions(true);

			// structMembers.forEach(
			//   (x) =>
			//     (results = this.mergeArrays(
			//       results,
			//       x.getAllReferencesToSelected(offset, documents)
			//     ))
			// );
			// functionMembers.forEach(
			//   (x) =>
			//     (results = results.concat(
			//       x.getAllReferencesToSelected(offset, documents)
			//     ))
			// );
		}
		return results
	}

	public override getHover(): Hover {
		return null
	}

	public findItem<T extends ParsedCode>(name: string): T {
		return this.getTypes(true).find((t) => t.name === name) as unknown as T
	}

	public getTypes<T extends ParsedType>(withImports = true): T[] {
		const results = []

		const structMembers = this.structs.map((s) => s.getInnerMembers()).flatMap((s) => s)
		const structMembersInner = this.innerContracts
			.map((s) => s.getAllStructs(true))
			.map((i) => i.map((s) => s.getInnerMembers()).flatMap((s) => s))
			.flatMap((s) => s)

		const functionMembers = this.functions.map((f) => f.getAllItems()).flatMap((s) => s)

		const fundctionMembersInner = this.innerContracts
			.map((s) => s.getAllFunctions(true))
			.map((i) => i.map((s) => s.getInnerMembers()).flatMap((s) => s))
			.flatMap((s) => s)

		const returnVs = results
			.concat(this.functions)
			.concat(functionMembers)
			.concat(fundctionMembersInner)
			.concat(this.innerContracts)
			.concat(this.errors)
			.concat(this.events)
			.concat(this.structs)
			.concat(structMembers)
			.concat(structMembersInner)
			.concat(this.usings)
			.concat(this.customTypes)
			.concat(this.constants)
			.concat(this.expressions)

		if (withImports) {
			for (const imported of this.importedDocuments) {
				results.concat(imported.getTypes<T>(false))
				for (const innerImport of imported.importedDocuments) {
					if (innerImport !== this) {
						results.concat(innerImport.getTypes<T>(false))
						for (const superInnerImport of innerImport.importedDocuments) {
							if (innerImport !== this) {
								results.concat(superInnerImport.getTypes<T>(false))
							}
						}
					}
				}
			}
		}

		return returnVs
	}

	public brute<T extends ParsedType>(name: string, withImports = true): T[] {
		const results = []
		let localResults = []
		const structMembers = this.structs.flatMap((s) => s.getInnerMembers())

		localResults = structMembers.filter((s) => s.name === name)
		if (localResults.length > 0) {
			return localResults
		}

		const structMembersInner = this.innerContracts
			.map((s) => s.getAllStructs(true))
			.flatMap((i) => i.map((s) => s.getInnerMembers()).flatMap((s) => s))

		localResults = structMembersInner.filter((s) => s.name === name)
		if (localResults.length > 0) {
			return localResults
		}

		const functionMembers = this.functions.flatMap((f) => f.getAllItems())
		localResults = functionMembers.filter((s) => s.name === name)
		if (localResults.length > 0) {
			return localResults
		}
		const funcMembersInner = this.innerContracts
			.map((s) => s.getAllFunctions(true))
			.flatMap((i) => i.flatMap((s) => s.getInnerMembers()))
		localResults = funcMembersInner.filter((s) => s.name === name)
		if (localResults.length > 0) {
			return localResults
		}

		const inherits = this.innerContracts.flatMap((s) =>
			s
				.getExtendedContractsRecursive()
				.flatMap((c) => {
					return [
						c.functions,
						c.getAllFunctions(true).flatMap((i) => i.getAllItems()),
						c.stateVariables,
						c.enums,
						c.errors,
						c.events,
						c.structs,
						c.structs.flatMap((s) => s.getInnerMembers()),
					]
				})
				.flat(),
		)
		const returnVs = results
			.concat(inherits)
			.concat(this.functions)
			.concat(this.innerContracts)
			.concat(this.errors)
			.concat(this.events)
			.concat(this.structs)
			.concat(this.usings)
			.concat(this.customTypes)
			.concat(this.constants)
			.concat(this.expressions)

		localResults = returnVs.filter((i) => i.name === name)

		if (localResults.length > 0) {
			return localResults
		}

		if (withImports) {
			for (const imported of this.importedDocuments) {
				const result0 = imported.brute<T>(name, false)
				if (result0.length > 0) {
					return result0
				}

				for (const innerImport of imported.importedDocuments) {
					if (innerImport !== this) {
						const result1 = imported.brute<T>(name, false)
						if (result1.length > 0) {
							return result1
						}
						for (const superInnerImport of innerImport.importedDocuments) {
							if (superInnerImport !== this) {
								const result2 = superInnerImport.brute<T>(name, false)
								if (result2.length > 0) {
									return result2
								}
							}
						}
					}
				}
			}
		}

		return returnVs.filter((i) => i.name === name)
	}
	public override getSelectedItem(offset: number): ParsedCode {
		let selectedItem: ParsedCode = null
		if (this.isCurrentElementedSelected(offset)) {
			let allItems: ParsedCode[] = []
			allItems = allItems
				.concat(this.functions)
				.concat(this.innerContracts)
				.concat(this.errors)
				.concat(this.events)
				.concat(this.structs)
				.concat(this.usings)
				.concat(this.customTypes)
				.concat(this.constants)
				.concat(this.imports)
				.concat(this.expressions)

			for (const item of allItems) {
				if (item == null) continue
				selectedItem = item.getSelectedItem(offset)
				if (selectedItem != null) {
					return selectedItem
				}
			}
			return this
		}
		this.selectedItem = selectedItem
		return selectedItem
	}

	public override getAllReferencesToObject(parsedCode: ParsedCode): TypeReference[] {
		let results: TypeReference[] = []

		for (const importItem of this.imports) {
			results = results.concat(importItem.getAllReferencesToObject(parsedCode))
		}

		for (const item of this.innerContracts) {
			results = results.concat(item.getAllReferencesToObject(parsedCode))
		}

		for (const func of this.functions) {
			results = results.concat(func.getAllReferencesToObject(parsedCode))
		}

		for (const struct of this.structs) {
			results = results.concat(struct.getAllReferencesToObject(parsedCode))
		}

		for (const using of this.usings) {
			results = results.concat(using.getAllReferencesToObject(parsedCode))
		}
		for (const error of this.errors) {
			results = results.concat(error.getAllReferencesToObject(parsedCode))
		}

		for (const event of this.events) {
			results = results.concat(event.getAllReferencesToObject(parsedCode))
		}

		for (const customType of this.customTypes) {
			results = results.concat(customType.getAllReferencesToObject(parsedCode))
		}

		for (const constant of this.constants) {
			results = results.concat(constant.getAllReferencesToObject(parsedCode))
		}

		for (const expression of this.expressions) {
			results = results.concat(expression.getAllReferencesToObject(parsedCode))
		}

		// for (const imported of this.importedDocuments) {
		// 	results = results.concat(imported.getAllReferencesToObject(parsedCode));
		// }

		// this.functions.forEach((x) => (results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode))));
		// this.errors.forEach((x) => (results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode))));
		// this.events.forEach((x) => (results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode))));

		// this.innerContracts.forEach((x) => (results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode))));
		// this.structs.forEach((x) => (results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode))));
		// this.usings.forEach((x) => (results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode))));
		// this.customTypes.forEach((x) => (results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode))));
		// this.constants.forEach((x) => (results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode))));
		// this.imports.forEach((x) => (results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode))));
		// this.expressions.forEach((x) => (results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode))));

		// const structMembers = this.structs
		//   .map((s) => s.getInnerMembers())
		//   .flatMap((s) => s);

		// const functionMembers = this.functions
		//   .map((f) => f.getAllItems())
		//   .flatMap((s) => s);

		// structMembers.forEach(
		//   (x) =>
		//     (results = this.mergeArrays(
		//       results,
		//       x.getAllReferencesToObject(parsedCode)
		//     ))
		// );
		// functionMembers.forEach(
		//   (x) =>
		//     (results = this.mergeArrays(
		//       results,
		//       x.getAllReferencesToObject(parsedCode)
		//     ))
		// );

		return results
	}

	public getFunctionReference(offset: number) {
		const results = this.getSelectedTypeReferenceLocation(offset)

		return results.filter((r) => r.reference?.element?.type === "FunctionDeclaration")
	}
	public getSelectedTypeReferenceLocation(offset: number): TypeReference[] {
		let results: TypeReference[] = []

		for (const importItem of this.imports) {
			results = results.concat(importItem.getSelectedTypeReferenceLocation(offset))
		}

		for (const item of this.innerContracts) {
			results = results.concat(item.getSelectedTypeReferenceLocation(offset))
		}

		for (const using of this.usings) {
			results = results.concat(using.getSelectedTypeReferenceLocation(offset))
		}

		for (const func of this.functions) {
			results = results.concat(func.getSelectedTypeReferenceLocation(offset))
		}

		for (const struct of this.structs) {
			results = results.concat(struct.getSelectedTypeReferenceLocation(offset))
		}

		for (const error of this.errors) {
			results = results.concat(error.getSelectedTypeReferenceLocation(offset))
		}

		for (const event of this.events) {
			results = results.concat(event.getSelectedTypeReferenceLocation(offset))
		}

		for (const customType of this.customTypes) {
			results = results.concat(customType.getSelectedTypeReferenceLocation(offset))
		}

		for (const constant of this.constants) {
			results = results.concat(constant.getSelectedTypeReferenceLocation(offset))
		}

		for (const expression of this.expressions) {
			results = results.concat(expression.getSelectedTypeReferenceLocation(offset))
		}

		// for (const imported of this.importedDocuments) {
		// 	results = results.concat(imported.getSelectedTypeReferenceLocation(offset));
		// }

		// this.functions.forEach((x) => {
		// 	results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset));
		// });

		// this.errors.forEach((x) => (results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset))));

		// this.events.forEach((x) => (results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset))));
		// this.innerContracts.forEach(
		// 	(x) => (results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)))
		// );

		// this.structs.forEach((x) => (results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset))));

		// this.usings.forEach((x) => (results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset))));
		// this.customTypes.forEach((x) => (results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset))));

		// this.constants.forEach((x) => (results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset))));
		// this.imports.forEach((x) => (results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset))));
		// this.expressions.forEach((x) => (results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset))));

		// const structMembers = this.getAllGlobalStructs()
		//   .map((s) => s.getInnerMembers())
		//   .flat();

		// const functionMembers = this.functions.map((f) => f.getAllItems()).flat();

		// structMembers.forEach(
		//   (x) =>
		//     (results = this.mergeArrays(
		//       results,
		//       x.getSelectedTypeReferenceLocation(offset)
		//     ))
		// );
		// functionMembers.forEach(
		//   (x) =>
		//     (results = this.mergeArrays(
		//       results,
		//       x.getSelectedTypeReferenceLocation(offset)
		//     ))
		// );
		const foundResult = TypeReference.filterFoundResults(results)
		if (foundResult.length > 0) {
			return foundResult
		} else {
			return [TypeReference.create(true)]
		}
	}

	public findType(name: string): ParsedCode {
		let typesParsed: ParsedCode[] = []
		const allStructs = this.getAllGlobalStructs()
		typesParsed = typesParsed
			.concat(this.getAllGlobalConstants())
			.concat(this.getAllGlobalCustomTypes())
			.concat(allStructs)
			.concat(this.getAllGlobalEnums())
			.concat(this.getAllContracts())

		let result = typesParsed.find((x) => x.name === name)
		if (result) return result

		result = allStructs.flatMap((s) => s.getInnerMembers()).find((x) => x.name === name)
		if (result) return result
	}

	public override getInnerMembers(): ParsedCode[] {
		let typesParsed: ParsedCode[] = []
		typesParsed = typesParsed
			.concat(this.getAllGlobalConstants())
			.concat(this.getAllGlobalEnums())
			.concat(this.getAllGlobalCustomTypes())
			.concat(this.getAllGlobalStructs())
		return typesParsed
	}

	public findMembersInScope(name: string): ParsedCode[] {
		return this.getInnerMembers().filter((x) => x.name === name)
	}

	public findMethodCalls(name: string, includeExtendedMethods = false): ParsedCode[] {
		let typesParsed: ParsedCode[] = []
		typesParsed = typesParsed
			.concat(this.getAllGlobalFunctions(includeExtendedMethods))
			.concat(this.getAllGlobalErrors())
			.concat(this.getAllContracts(true))
		return typesParsed.filter((x) => x.name === name)
	}

	public getLocation() {
		const uri = URI.file(this.sourceDocument.absolutePath).toString()
		const document = TextDocument.create(uri, null, null, this.sourceDocument.code)
		return Location.create(
			document.uri,
			Range.create(document.positionAt(this.element.start), document.positionAt(this.element.end)),
		)
	}

	public getGlobalPathInfo(): string {
		return `${this.sourceDocument.absolutePath} global`
	}

	public getAllGlobalFunctionCompletionItems(): CompletionItem[] {
		const completionItems: CompletionItem[] = []
		this.getAllGlobalFunctions().forEach((x) => completionItems.push(x.createCompletionItem()))
		return completionItems
	}

	public getAllGlobalEventsCompletionItems(): CompletionItem[] {
		const completionItems: CompletionItem[] = []
		this.getAllGlobalEvents().forEach((x) => completionItems.push(x.createCompletionItem()))
		return completionItems
	}

	public getAllGlobalErrorsCompletionItems(): CompletionItem[] {
		const completionItems: CompletionItem[] = []
		this.getAllGlobalErrors().forEach((x) => completionItems.push(x.createCompletionItem()))
		return completionItems
	}

	public getAllGlobalStructsCompletionItems(): CompletionItem[] {
		const completionItems: CompletionItem[] = []
		this.getAllGlobalStructs().forEach((x) => completionItems.push(x.createCompletionItem()))
		return completionItems
	}

	public getAllGlobalEnumsCompletionItems(): CompletionItem[] {
		const completionItems: CompletionItem[] = []
		this.getAllGlobalEnums().forEach((x) => completionItems.push(x.createCompletionItem()))
		return completionItems
	}

	public getAllGlobalCustomTypesCompletionItems(): CompletionItem[] {
		const completionItems: CompletionItem[] = []
		this.getAllGlobalCustomTypes().forEach((x) => completionItems.push(x.createCompletionItem()))
		return completionItems
	}

	public getAllGlobalConstantCompletionItems(): CompletionItem[] {
		const completionItems: CompletionItem[] = []
		this.getAllGlobalConstants().forEach((x) => completionItems.push(x.createCompletionItem()))
		return completionItems
	}

	public getAllGlobalContractsCompletionItems(): CompletionItem[] {
		const completionItems: CompletionItem[] = []
		this.getAllContracts().forEach((x) => completionItems.push(x.createCompletionItem()))
		return completionItems
	}

	public getSelectedDocumentCompletionItems(offset: number): CompletionItem[] {
		let completionItems: CompletionItem[] = []
		completionItems = completionItems.concat(this.getAllGlobalFunctionCompletionItems())
		completionItems = completionItems.concat(this.getAllGlobalEventsCompletionItems())
		completionItems = completionItems.concat(this.getAllGlobalStructsCompletionItems())
		completionItems = completionItems.concat(this.getAllGlobalEnumsCompletionItems())
		completionItems = completionItems.concat(this.getAllGlobalCustomTypesCompletionItems())
		completionItems = completionItems.concat(this.getAllGlobalConstantCompletionItems())
		completionItems = completionItems.concat(this.getAllGlobalContractsCompletionItems())

		if (this.selectedFunction) {
			const variablesInScope = this.selectedFunction.findVariableDeclarationsInScope(offset)
			this.selectedFunction.input.forEach((parameter) => {
				if (parameter.name !== "self") {
					completionItems.push(parameter.createParamCompletionItem("function parameter", this.getGlobalPathInfo()))
				}
			})
			this.selectedFunction.output.forEach((parameter) => {
				completionItems.push(parameter.createParamCompletionItem("return parameter", this.getGlobalPathInfo()))
			})

			for (const variable of variablesInScope) {
				completionItems.push(variable.createCompletionItem())
			}
		}
		return completionItems
	}

	public initialiseVariablesMembersEtc(statement: any, _parentStatement: any, child: ParsedExpression) {
		if (!statement) return
		try {
			if (statement?.type) {
				switch (statement.type) {
					case "CallExpression": {
						// e.g. Func(x, y)
						const callExpression = ParsedExpression.createFromElement(statement, this, null, child, this)
						this.expressions.push(callExpression)
						break
					}
					case "MemberExpression": {
						// e.g. x.y x.f(y) arr[1] map['1'] arr[i] map[k]
						const memberCreated = ParsedExpression.createFromMemberExpression(statement, this, null, child, this)

						this.expressions.push(memberCreated)
						break
					}
					case "Identifier": {
						const identifier = ParsedExpression.createFromElement(statement, this, null, child, this)

						this.expressions.push(identifier)
						break
					}
					case "FunctionDeclaration":
						break
					case "ContractStatement":
						break
					case "LibraryStatement":
						break
					case "InterfaceStatement":
						break
					default:
						for (const key in statement) {
							if (statement.hasOwnProperty(key)) {
								const element = statement[key]
								if (Array.isArray(element)) {
									// recursively drill down to collections e.g. statements, params
									for (const innerElement of element) {
										this.initialiseVariablesMembersEtc(innerElement, statement, null)
									}
								} else if (element instanceof Object) {
									// recursively drill down to elements with start/end e.g. literal type
									if (element.hasOwnProperty("start") && element.hasOwnProperty("end")) {
										this.initialiseVariablesMembersEtc(element, statement, null)
									}
								}
							}
						}
				}
			}
		} catch (error) {}
	}

	private matchesElement(selectedElement: any, element: any) {
		return selectedElement != null && selectedElement === element
	}
}
