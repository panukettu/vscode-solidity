import { Location } from "vscode-languageserver"
import { TypeReference } from "../search/TypeReference"
import { ParsedCode } from "./ParsedCode"
import { ParsedContract } from "./ParsedContract"
import { ParsedDocument } from "./ParsedDocument"

export class ParsedContractIs extends ParsedCode {
	private contractReference: ParsedContract = null

	public override initialise(element: any, document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
		super.initialise(element, document, contract, isGlobal)
		this.name = element.name
	}

	public initialiseContractReference(): ParsedContract {
		if (this.contractReference) {
			return this.contractReference
		}

		this.contractReference = this.document.findContractByName(this.name)

		if (this.contractReference) {
			this.contractReference.initialiseExtendContracts()
		}

		return this.contractReference
	}

	public getContractReference(): ParsedContract {
		return this.initialiseContractReference()
	}

	public getContractReferenceLocation(): Location {
		return this.getContractReference().getLocation()
	}

	public override getSelectedTypeReferenceLocation(offset: number): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			return [TypeReference.create(true, this.getContractReferenceLocation())]
		}
		return [TypeReference.create(false)]
	}

	public override getAllReferencesToThis(): TypeReference[] {
		const results: TypeReference[] = []
		results.push(this.createFoundReferenceLocationResult())
		return results.concat(this.document.getAllReferencesToObject(this.getContractReference()))
	}

	public override getAllReferencesToObject(parsedCode: ParsedCode): TypeReference[] {
		if (this.isTheSame(parsedCode)) {
			return [this.createFoundReferenceLocationResult()]
		} else {
			const reference = this.getContractReference()
			if (reference?.isTheSame(parsedCode)) {
				return [this.createFoundReferenceLocationResult()]
			}
		}
	}

	public override getInfo(): string {
		const reference = this.getContractReference()
		if (reference) {
			return reference.getInfo()
		} else {
			return `### contract: ${this.name}`
		}
	}
}
