import { CompletionItem } from 'vscode-languageserver';
import { TypeReference } from '../search/TypeReference';
import { ParsedCode } from './ParsedCode';
import { ParsedContract } from './ParsedContract';
import { ParsedDocument } from './ParsedDocument';
import { ParsedFunction } from './ParsedFunction';
import { ParsedUsing } from './ParsedUsing';
import { getMappingParts, getTypeString, valueTypeReg } from './utils/ParsedCodeTypeHelper';

export class ParsedDeclarationType extends ParsedCode {
	public isArray: boolean;

	public isMapping: boolean;

	public isValueType: boolean;
	public parentTypeName: string;
	public type: ParsedCode;

	public getArraySignature(): string {
		if (!this.isArray) return '';
		return `[${this.getArrayParts()}]`;
	}

	public getArrayParts(): string {
		if (!this.isArray) return '';
		// @ts-expect-error
		return this.element?.array_parts[0]
			? // @ts-expect-error
			  String(this.element?.array_parts[0])
			: '';
	}

	public getMappingParts(): string[] {
		try {
			const typeString = getMappingParts(this.element);

			return typeString.trim().split('=>');
		} catch {
			return [];
		}
	}

	public createMappingSnippet(): string {
		const parts = this.getMappingParts().slice(0, -1);
		let snippet = '';
		let counter = 0;
		if (parts.length > 0) {
			for (const type of parts) {
				counter = counter + 1;
				const currentParamSnippet = `[\${${counter}:${type}}]`;
				if (snippet === '') {
					snippet = currentParamSnippet;
				} else {
					snippet = snippet + currentParamSnippet;
				}
			}
		}
		return snippet;
	}

	public getTypeSignature(): string {
		if (this.isMapping) {
			return getTypeString(this.element);
		}
		return this.name + this.getArraySignature();
	}
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	public static create(literal: any, contract: ParsedContract, document: ParsedDocument): ParsedDeclarationType {
		const declarationType = new ParsedDeclarationType();
		declarationType.initialise(literal, document, contract);
		return declarationType;
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	public override initialise(element: any, document: ParsedDocument, contract: ParsedContract, isGlobal = false) {
		super.initialise(element, document, contract, isGlobal);
		if (element.members !== undefined && element.members.length > 0) {
			this.name = element.members[0];
			this.parentTypeName = element.literal;
		} else {
			if (element.literal.literal !== undefined) {
				this.name = element.literal.literal;
			} else {
				this.name = element.literal;
			}
		}
		this.isArray = element.array_parts.length > 0;
		this.isMapping = false;
		const literalType = element.literal;

		if (typeof literalType?.type !== 'undefined') {
			this.isMapping = literalType.type === 'MappingExpression';
			this.name = 'mapping'; // do something here
			// suffixType = '(' + this.getTypeString(literalType.from) + ' => ' + this.getTypeString(literalType.to) + ')';
		}
		this.isValueType = !this.isMapping && valueTypeReg.test(this.name);
	}

	public override getInnerCompletionItems(skipSelf = false): CompletionItem[] {
		const result: CompletionItem[] = [];

		for (const item of this.getExtendedMethodCallsFromUsing()) {
			if (item instanceof ParsedFunction) {
				result.push(item.createCompletionItem(skipSelf));
			} else {
				result.push(item.createCompletionItem());
			}
		}

		const type = this.findType();

		if (!type) {
			return result;
		}

		return result.concat(type.getInnerCompletionItems());
	}

	public override getInnerMembers(): ParsedCode[] {
		const type = this.findType();
		if (!type) {
			return [];
		}
		return type.getInnerMembers();
	}

	public override getInnerMethodCalls(): ParsedCode[] {
		let result: ParsedCode[] = [];
		result = result.concat(this.getExtendedMethodCallsFromUsing());
		const type = this.findType();
		if (!type) {
			return result;
		}
		return result.concat(type.getInnerMethodCalls());
	}

	public getExtendedMethodCallsFromUsing(): ParsedCode[] {
		let usings: ParsedUsing[] = [];
		if (this.contract) {
			usings = this.contract.getAllUsing(this);
		} else {
			usings = ParsedDocument.getAllGlobalUsing(this.document, this);
		}

		let result: ParsedCode[] = [];

		for (const usingItem of usings) {
			const foundLibrary = this.document.getAllContracts().find((x) => x.name === usingItem.name);

			if (!foundLibrary) continue;

			const allfunctions = foundLibrary.getAllFunctions();
			const filteredFunctions = allfunctions.filter((x) => {
				if (x.input.length > 0) {
					const typex = x.input[0].type;
					let validTypeName = false;
					if (typex.name === this.name || (this.name === 'address_payable' && typex.name === 'address')) {
						validTypeName = true;
					}
					return typex.isArray === this.isArray && validTypeName && typex.isMapping === this.isMapping;
				}
				return false;
			});
			result = result.concat(filteredFunctions);
		}

		return result;
	}

	public findType(): ParsedCode {
		if (!this.type) {
			if (this.parentTypeName) {
				const parentType = this.findTypeInScope(this.parentTypeName);
				if (parentType !== undefined) {
					this.type = parentType.findTypeInScope(this.name);
				}
			} else {
				this.type = this.findTypeInScope(this.name);
			}
		}
		return this.type;
	}

	public override getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			const type = this.findType();
			if (type) {
				return type.getAllReferencesToThis(documents);
			}
		}
		return [];
	}

	public override getAllReferencesToObject(parsedCode: ParsedCode): TypeReference[] {
		if (this.isTheSame(parsedCode)) {
			return [this.createFoundReferenceLocationResult()];
		}
		// const type = this.findType();
		if (this.type?.isTheSame(parsedCode)) {
			return [this.createFoundReferenceLocationResult()];
		}
		return [];
	}

	public getTypeDefinition() {
		const type = this.findType();
		if (type) return type;
		return this;
	}

	public getInfo(): string {
		let returnString = '';
		if (this.isArray) {
			returnString = '### Array \n';
		}
		const type = this.findType();
		if (this.type != null) {
			return returnString + type.getInfo();
		}
		return `${returnString}: ${this.name}`;
	}
}
