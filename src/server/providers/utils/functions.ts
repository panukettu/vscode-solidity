import { ParameterInformation } from 'vscode-languageserver';
import { ParsedDocument } from '../../code/ParsedDocument';
import { ParsedFunction } from '../../code/ParsedFunction';

export const getFunctionsByNameOffset = (functionNames: string[], document: ParsedDocument, offset: number) => {
	if (!functionNames?.length) {
		throw new Error('No function names found');
	}
	try {
		const functionName = functionNames[functionNames.length - 1];

		if (!functionName) {
			throw new Error('No function name found');
		}
		const selectedItem = document.getSelectedItem(offset);
		let methodsFound = selectedItem.findMethodsInScope(functionName, true) as ParsedFunction[];

		if (!methodsFound?.length && document.selectedFunction) {
			methodsFound = document.selectedFunction.findMethodsInScope(functionName, true) as ParsedFunction[];
		}

		return methodsFound;
	} catch (e) {
		console.debug('Unhandled', e);
	}
};

export const getFunctionByName = (document: ParsedDocument, functionNames: string[]) => {
	const functionName = functionNames[functionNames.length - 1];
	let methodsFound = document.findMethodCalls(functionName, true) as ParsedFunction[];
	if (!methodsFound.length) {
		for (const contract of document.getAllContracts()) {
			methodsFound = contract.findMethodCalls(functionName, true) as ParsedFunction[];
			if (methodsFound.length) {
				break;
			}
		}
	}

	return methodsFound;
};
export const getFunctionsByName = (functionNames: string[], documents: ParsedDocument[]) => {
	const functionName = functionNames[functionNames.length - 1];
	let methodsFound: ParsedFunction[] = [];
	for (const document of documents) {
		methodsFound = methodsFound.concat(document.findMethodCalls(functionName, true) as ParsedFunction[]);
		for (const contract of document.getAllContracts()) {
			methodsFound = methodsFound.concat(
				contract.findMethodCalls(functionName, true) as ParsedFunction[]
			) as ParsedFunction[];
		}
	}

	return methodsFound;
};
export const findByParam = (
	methods: ParsedFunction[],
	paramIndex?: number,
	searchParam?: { name: string },
	skipSelf?: boolean
) => {
	let selectedFunction: ParsedFunction;

	const hasIndex = typeof paramIndex !== 'undefined';
	if (!searchParam && !hasIndex) {
		return {
			selectedFunction: methods[0],
			...createFuncParams(methods[0], skipSelf),
		};
	} else {
		for (const method of methods.filter(
			(x) => x.input.length > (hasIndex ? (skipSelf ? paramIndex + 1 : paramIndex) : 1)
		)) {
			const matchingParam = method.input.find((inputParam, index) => {
				if (hasIndex) {
					if (index === paramIndex) {
						method.selectedInput = skipSelf ? index - 1 : index;
						return true;
					}
				} else if (!!searchParam?.name && inputParam.name === searchParam.name) {
					method.selectedInput = skipSelf ? index - 1 : index;
					return true;
				}
			});

			if (matchingParam) {
				selectedFunction = method;
				break;
			}
		}
	}
	if (!selectedFunction) {
		return {
			inputs: [],
			selectedFunction: null,
			parameters: [],
		};
	}

	return {
		selectedFunction,
		...createFuncParams(selectedFunction, skipSelf, paramIndex),
	};
};

export const createFuncParams = (method: ParsedFunction, removeSelf: boolean, activeParam?: number) => {
	const inputs = removeSelf ? method.input.slice(1) : method.input;
	// const inputs = removeSelf
	//   ? method.input.filter(
	//       (i) =>
	//         i.name !== "self" &&
	//         i.name !== "_self" &&
	//         i.name !== "this" &&
	//         i.name !== "_this"
	//     )
	//   : method.input;
	const parameters: ParameterInformation[] = inputs.map((i, index) => {
		return {
			label: i.name,
			documentation: {
				kind: 'markdown',
				value: i.getSignatureDoc(),
				// value: i.getSimpleDetail(
				//   false,
				//   true,
				//   typeof activeParam !== "undefined" && activeParam === index
				// ),
			},
		};
	});

	return { parameters, inputs };
};
