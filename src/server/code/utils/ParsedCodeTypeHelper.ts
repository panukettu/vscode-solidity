import { ParsedCode } from "../ParsedCode";
import { ParsedFunction } from "../ParsedFunction";
import { ParsedFunctionVariable } from "../ParsedFunctionVariable";

export class ParsedCodeTypeHelper {
	public static getTypeString(literal: any) {
		const isArray = literal?.array_parts && literal?.array.parts?.length > 0;
		let isMapping = false;
		let literalType: any;
		let parentType: string = null;
		if (literal.members !== undefined && literal.members?.length > 0) {
			literalType = literal.members[0];
			parentType = literal.literal;
		} else {
			literalType = literal.literal;
		}

		let suffixType = "";

		if (typeof literalType.type !== "undefined") {
			isMapping = literalType.type === "MappingExpression";
			if (isMapping) {
				suffixType = `(${this.getTypeString(
					literalType.from,
				)} => ${this.getTypeString(literalType.to)})`;
			}
		}

		if (isArray) {
			const arraySuffix = literal?.array_parts.length
				? literal.array_parts[0]
				: "";
			suffixType = suffixType + (arraySuffix ? `[${arraySuffix}]` : "[]");
		}

		if (isMapping) {
			return "mapping" + suffixType;
		}

		if (parentType !== null) {
			return parentType + "." + literalType + suffixType;
		}

		return literalType + suffixType;
	}
	public static getMappingParts(literal: any) {
		const isArray = literal?.array_parts && literal?.array.parts?.length > 0;
		let isMapping = false;
		let literalType: any;
		let parentType: string = null;
		if (literal.members !== undefined && literal.members?.length > 0) {
			literalType = literal.members[0];
			parentType = literal.literal;
		} else {
			literalType = literal.literal;
		}

		let suffixType = "";

		if (typeof literalType.type !== "undefined") {
			isMapping = literalType.type === "MappingExpression";
			if (isMapping) {
				suffixType =
					this.getMappingParts(literalType.from) +
					"=>" +
					this.getMappingParts(literalType.to);
			}
		}

		if (isArray) {
			const arraySuffix = literal?.array_parts.length
				? literal.array_parts[0]
				: "";
			suffixType = suffixType + (arraySuffix ? `[${arraySuffix}]` : "[]");
		}

		if (isMapping) {
			return suffixType;
		}

		if (parentType !== null) {
			return parentType + "." + literalType + suffixType;
		}

		return literalType + suffixType;
	}

	public static getMappingFrom(literal: any): string {
		if (literal?.literal?.from) {
			return literal.literal.from.literal;
		}
	}
	public static getMappingTo(literal: any): any {
		if (literal?.literal?.from) {
			return literal.literal.to.literal;
		}
	}

	public static typesForFuncInput(
		offset: number,
		outerFunc: ParsedFunction,
		innerFunc: ParsedFunction,
	) {
		if (!innerFunc?.input?.length)
			return {
				relevantVars: [],
				relevantParams: [],
			};
		const targetTypes = innerFunc.input.map((i) => i.type.name);

		const outerFunctioVars = outerFunc.findAllLocalAndGlobalVariables(
			offset,
		) as ParsedFunctionVariable[];
		const relevantVars = outerFunctioVars.filter((v) =>
			targetTypes.includes(v.type?.name),
		);

		const relevantParams = outerFunc.output
			.concat(outerFunc.input)
			.filter((v) => targetTypes.includes(v.type?.name));

		return {
			relevantVars,
			relevantParams,
		};
	}
	public static mappingOutType(mapping: ParsedCode) {
		// @ts-expect-error
		const result = this.getMappingParts(mapping.element.literal)
			.split("=>")
			.slice(-1)
			.join("");

		return {
			result,
			isValueType: valueTypeReg.test(result),
		};
	}
	public static typesForMappingInput(
		offset: number,
		outerFunc: ParsedFunction,
		mapping: ParsedCode,
		mappingIndex = 1,
	) {
		try {
			// @ts-expect-error
			const typeName = this.getMappingParts(mapping.element.literal).split(
				"=>",
			)[mappingIndex - 1];

			const outerFunctioVars = outerFunc.findAllLocalAndGlobalVariables(
				offset,
			) as ParsedFunctionVariable[];

			const relevantVars = outerFunctioVars.filter(
				(v) => v.type?.name === typeName,
			);

			const relevantParams = outerFunc.output
				.concat(outerFunc.input)
				.filter((v) => v.type?.name === typeName);

			return {
				relevantVars,
				relevantParams,
			};
		} catch (e) {
			// console.debug("mapping", e.message);
			return {
				relevantVars: [],
				relevantParams: [],
			};
		}
	}
}

export const valueTypeReg =
	/(address|bool|string|bytes\d{0,2}|(uint|int)(\d|\W))/;
export const valueTypes = [
	"address",
	"bool",
	"string",
	"byte",
	"bytes",
	"uint",
	"int",
];
