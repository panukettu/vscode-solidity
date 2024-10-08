import { CompletionItem } from "vscode-languageserver"
import { providerRequest } from "../providers/utils/common"
import type { ParsedContract } from "./ParsedContract"
import { ParsedCustomType } from "./ParsedCustomType"
import { ParsedDeclarationType } from "./ParsedDeclarationType"
import type { ParsedDocument } from "./ParsedDocument"
import { ParsedEnum } from "./ParsedEnum"
import type { ParsedFunction } from "./ParsedFunction"
import type { ParsedImport } from "./ParsedImport"
import type { ParsedParameter } from "./ParsedParameter"
import { ParsedStruct } from "./ParsedStruct"
import { ParsedVariable } from "./ParsedVariable"
import { getTypeString } from "./utils/ParsedCodeTypeHelper"

export class ParsedStructVariable extends ParsedVariable {
	public struct: ParsedStruct
	private completionItem: CompletionItem = null
	public abiType: string | null
	public isContract: boolean
	public importRef: ParsedImport | null

	public properties: ParsedStructVariable[]
	public items: string[]

	public initialiseStructVariable(
		element: any,
		contract: ParsedContract,
		document: ParsedDocument,
		struct: ParsedStruct,
		typeRef?: ParsedStruct | ParsedEnum | ParsedCustomType,
	) {
		this.element = element
		this.name = element.name
		this.document = document

		this.type = ParsedDeclarationType.create(element.literal, contract, document, typeRef)

		if (typeRef instanceof ParsedStruct) {
			this.properties = typeRef.properties
		} else if (typeRef instanceof ParsedEnum) {
			this.items = typeRef.items
		} else if (typeRef instanceof ParsedCustomType) {
			this.abiType = typeRef.isType + this.type.getArraySignature()
		} else {
			this.abiType = this.type.isValueType ? this.type.getTypeSignature() : null

			if (!this.abiType) {
				const imported = this.document.sourceDocument.imports.find(
					(i) => i.importPath.indexOf(this.type.name) !== -1,
				)?.importPath

				if (imported) {
					this.abiType = `address${this.type.getArraySignature()}`
					this.importRef = this.document.imports.find((i) => {
						return i.from.includes(imported)
					})
				}
			}
		}
		this.struct = struct
	}
	public createCompletionItem(): CompletionItem {
		if (!this.completionItem) {
			const item = CompletionItem.create(this.name)
			if (this.type.isMapping) {
				item.insertText = `${this.name + this.type.createMappingSnippet()};`
				item.insertTextFormat = 2
			}
			item.detail = `${this.getRootName()}.${this.struct.name}.${this.name}`
			item.documentation = {
				kind: "markdown",
				value: this.createShortInfo("", this.getElementInfo(), true, true, ""),
			}
			this.completionItem = item
		}
		return this.completionItem
	}

	public override getParsedObjectType(): string {
		return "struct member"
	}

	public getElementInfo(): string {
		let storageType = undefined
		if (!this.type.isMapping && this.struct.hasMapping) {
			storageType = "storage"
		}

		// else if (providerRequest.selectedDocument) {
		//   const selectedFunction = this.getSelectedFunction(
		//     providerRequest.currentOffset
		//   );

		//   if (selectedFunction) {
		//     const parent = [
		//       ...selectedFunction.input,
		//       ...selectedFunction.output,
		//       ...selectedFunction.variables,
		//     ].find((i) => i.element.literal.literal === this.struct.name);
		//     if (parent) {
		//       storageType = parent.element.storage_location;
		//     }
		//   } else {
		//     const refs = providerRequest.selectedDocument
		//       .getAllReferencesToObject(this)
		//       .filter((r) => !!r?.reference) as any[];
		//     const found = refs.find(
		//       (t) => !!t?.reference?.parent?.reference?.element?.storage_location
		//     ) as ParsedCode | undefined;
		//     if (found) {
		//       // @ts-ignore
		//       const parent = found.reference.parent
		//         .reference as ParsedExpressionIdentifier;
		//       if (parent.parent) {
		//         const isSelected = parent.isElementedSelected(
		//           this.element,
		//           providerRequest.currentOffset
		//         );
		//         storageType = isSelected ? parent.element?.storage_location : "";
		//       }
		//     }
		//   }
		// }

		return (
			// @ts-expect-error
			getTypeString(this.element?.literal) + (storageType ? ` ${storageType}` : "")
		)
	}

	public getSelectedFunction(offset: number): ParsedFunction {
		let result: ParsedFunction | undefined
		if (!this.contract) {
			const allFuncs = this.document.getFunctionReference(offset)
			result = allFuncs.find((f) => f?.reference.isCurrentElementedSelected(offset))?.reference as ParsedFunction
		} else {
			result = this.contract.getSelectedFunction(offset)
		}

		if (!result) {
			let paramArray: ParsedParameter[] = []

			for (const inner of providerRequest.selectedDocument.innerContracts) {
				const inputs = inner
					.getAllFunctions()
					.flatMap((f) => [...f.input, ...f.output, ...f.variables])
					.filter((i) => i.element.literal.literal === this.struct.name)

				if (inputs.length > 0) paramArray = paramArray.concat(inputs as any)
			}
			for (const param of paramArray) {
				const foundFunc = param.getSelectedFunction(providerRequest.currentOffset)
				if (foundFunc?.name) return foundFunc
			}
		}
		return result
	}

	public override getInfo(): string {
		return this.createInfo(
			this.struct.getRootName(),
			this.struct.name,
			`.${this.name}: ${this.getElementInfo()}`,
			undefined,
			true,
			true,
		)
	}
	public override getShortInfo(): string {
		return this.createShortInfo(this.struct.name, `.${this.name}: ${this.getElementInfo()}`, true, true, "")
	}
}
