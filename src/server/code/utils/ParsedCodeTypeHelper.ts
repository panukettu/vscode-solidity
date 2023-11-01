import { ParsedCode } from '../ParsedCode';
import { ParsedFunction } from '../ParsedFunction';
import { ParsedFunctionVariable } from '../ParsedFunctionVariable';

export const getTypeString = (literal: any) => {
	const isArray = literal?.array_parts && literal?.array_parts?.length > 0;
	let isMapping = false;

	let literalType: any;
	let parentType: string | undefined;
	if (literal.members !== undefined && literal.members?.length > 0) {
		literalType = literal.members[0];
		parentType = literal.literal;
	} else {
		literalType = literal.literal;
	}

	let suffixType = '';

	if (typeof literalType.type !== 'undefined') {
		isMapping = literalType.type === 'MappingExpression';
		if (isMapping) {
			suffixType = `(${getTypeString(literalType.from)} => ${getTypeString(literalType.to)})`;
		}
	}

	if (isArray) {
		const arraySuffix = literal?.array_parts.length ? literal.array_parts[0] : '';
		suffixType = suffixType + (arraySuffix ? `[${arraySuffix}]` : '[]');
	}

	if (isMapping) {
		return `mapping${suffixType}`;
	}

	if (parentType) {
		return `${parentType}.${literalType}${suffixType}`;
	}

	return literalType + suffixType;
};

export const getMappingParts = (literal: any) => {
	const isArray = literal?.array_parts && literal?.array_parts?.length > 0;
	let isMapping = false;

	let literalType: any;
	let parentType: string | undefined;

	if (literal.members !== undefined && literal.members?.length > 0) {
		literalType = literal.members[0];
		parentType = literal.literal;
	} else {
		literalType = literal.literal;
	}

	let suffixType = '';

	if (typeof literalType.type !== 'undefined') {
		isMapping = literalType.type === 'MappingExpression';
		if (isMapping) {
			suffixType = `${getMappingParts(literalType.from)}=>${getMappingParts(literalType.to)}`;
		}
	}

	if (isArray) {
		const arraySuffix = literal?.array_parts.length ? literal.array_parts[0] : '';
		suffixType = suffixType + (arraySuffix ? `[${arraySuffix}]` : '[]');
	}

	if (isMapping) {
		return suffixType;
	}

	if (parentType) {
		return `${parentType}.${literalType}${suffixType}`;
	}

	return literalType + suffixType;
};

export const typeHelp = {
	getMappingFrom(literal: any): string {
		if (literal?.literal?.from) {
			return literal.literal.from.literal;
		}
	},

	getMappingTo(literal: any): string {
		if (literal?.literal?.from) {
			return literal.literal.to.literal;
		}
	},

	typesForFuncInput(offset: number, outerFunc: ParsedFunction, innerFunc: ParsedFunction) {
		if (!innerFunc?.input?.length)
			return {
				relevantVars: [],
				relevantParams: [],
			};
		const targetTypes = innerFunc.input.map((i) => i.type.name);

		const outerFunctioVars = outerFunc.findAllLocalAndGlobalVariables(offset) as ParsedFunctionVariable[];
		const relevantVars = outerFunctioVars.filter((v) => targetTypes.includes(v.type?.name));

		const relevantParams = outerFunc.output.concat(outerFunc.input).filter((v) => targetTypes.includes(v.type?.name));

		return {
			relevantVars,
			relevantParams,
		};
	},
	typesForMappingInput(offset: number, outerFunc: ParsedFunction, mapping: ParsedCode, mappingIndex = 1) {
		try {
			// @ts-expect-error
			const typeName = getMappingParts(mapping.element.literal).split('=>')[mappingIndex - 1];

			const outerFunctioVars = outerFunc.findAllLocalAndGlobalVariables(offset) as ParsedFunctionVariable[];

			const relevantVars = outerFunctioVars.filter((v) => v.type?.name === typeName);

			const relevantParams = outerFunc.output.concat(outerFunc.input).filter((v) => v.type?.name === typeName);

			return {
				relevantVars,
				relevantParams,
			};
		} catch (e) {
			return {
				relevantVars: [],
				relevantParams: [],
			};
		}
	},
	mappingOutType(mapping: ParsedCode) {
		// @ts-expect-error
		const result = getMappingParts(mapping.element.literal).split('=>').slice(-1).join('');

		return {
			result,
			isValueType: valueTypeReg.test(result),
		};
	},
};

export const valueTypeReg = /(address|bool|string|bytes\d{0,2}|(uint|int)(\d|\W))/;
export const valueTypes = ['address', 'bool', 'string', 'byte', 'bytes', 'uint', 'int'];
