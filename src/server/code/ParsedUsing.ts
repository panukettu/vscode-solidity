import type { TypeReference } from "../search/TypeReference"
import { ParsedCode } from "./ParsedCode"
import type { ParsedContract } from "./ParsedContract"
import { ParsedDeclarationType } from "./ParsedDeclarationType"
import type { ParsedDocument } from "./ParsedDocument"

export class ParsedUsing extends ParsedCode {
	public for: ParsedDeclarationType
	public forStar = false

	public override getInfo(): string {
		const forIsArray = this.for.getArraySignature()
		return this.createInfo(
			"",
			"",
			`${this.name} for ${this.getRootName()}.${this.for.name + forIsArray || "*"}`,
			undefined,
			true,
			false,
		)
	}

	public getParsedObjectType(): string {
		return this.isGlobal ? "using global" : "using"
	}

	public initialise(element: any, document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
		this.contract = contract
		this.element = element
		this.name = element.library.literal
		this.document = document
		this.isGlobal = isGlobal

		if (element.for === "*") {
			this.forStar = true
			this.for = null
		} else {
			this.for = ParsedDeclarationType.create(element.for, this.contract, this.document)
		}
	}

	public override getSelectedTypeReferenceLocation(offset: number): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			if (this.for != null) {
				const foundType = this.for.findType()
				if (foundType != null) {
					return [foundType.createFoundReferenceLocationResult()]
				}
				return [this.createFoundReferenceLocationResultNoLocation()]
			}
		}
		return [this.createNotFoundReferenceLocationResult()]
	}
}
