import { ParameterInformation } from "vscode-languageserver";
import { ParsedDocument } from "../../code/ParsedDocument";
import { ParsedFunction } from "../../code/ParsedFunction";

export const getFunctionsByNameOffset = (
  functionNames: string[],
  document: ParsedDocument,
  offset: number
) => {
  if (!functionNames?.length) {
    throw new Error("No function names found");
  }

  const functionName = functionNames[functionNames.length - 1];

  console.debug(document.selectedItem?.name);
  console.debug(document.selectedFunction?.name);
  let methodsFound = document
    .getSelectedItem(offset)
    .findMethodsInScope(functionName, true) as ParsedFunction[];

  if (!methodsFound?.length && document.selectedFunction) {
    methodsFound = document.selectedFunction.findMethodsInScope(
      functionName
    ) as ParsedFunction[];
    if (methodsFound.length) {
      console.debug("found 2", methodsFound.length);
    }

    if (!methodsFound?.length) {
      console.debug("not found", functionName);
    }
  } else {
    console.debug("found 1");
  }

  return methodsFound;
};

export const getFunctionByName = (
  document: ParsedDocument,
  functionNames: string[]
) => {
  const functionName = functionNames[functionNames.length - 1];
  let methodsFound = document.findMethodCalls(
    functionName,
    true
  ) as ParsedFunction[];
  if (!methodsFound.length) {
    for (const contract of document.getAllContracts()) {
      methodsFound = contract.findMethodCalls(
        functionName,
        true
      ) as ParsedFunction[];
      if (methodsFound.length) {
        break;
      }
    }
  }

  return methodsFound;
};
export const findByParam = (
  methods: ParsedFunction[],
  paramIndex?: number,
  searchParam?: { name: string },
  removeself?: boolean
) => {
  let selectedFunction: ParsedFunction;

  const hasIndex = typeof paramIndex !== "undefined";
  if (!searchParam && !hasIndex) {
    return {
      selectedFunction: methods[0],
      ...createFuncParams(methods[0], removeself),
    };
  } else {
    for (const method of methods.filter(
      (x) =>
        x.input.length >
        (hasIndex ? (removeself ? paramIndex + 1 : paramIndex) : 1)
    )) {
      const matchingParam = method.input.find((inputParam, index) => {
        if (hasIndex) {
          if (index === paramIndex) {
            method.selectedInput = removeself ? index - 1 : index;
            return true;
          }
        } else if (
          !!searchParam?.name &&
          inputParam.name === searchParam.name
        ) {
          method.selectedInput = removeself ? index - 1 : index;
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
    ...createFuncParams(selectedFunction, removeself, paramIndex),
  };
};

export const createFuncParams = (
  method: ParsedFunction,
  removeSelf: boolean,
  activeParam?: number
) => {
  const inputs = removeSelf
    ? method.input.filter(
        (i) =>
          i.name !== "self" &&
          i.name !== "_self" &&
          i.name !== "this" &&
          i.name !== "_this"
      )
    : method.input;
  const parameters: ParameterInformation[] = inputs.map((i, index) => {
    return {
      label: i.name,
      documentation: {
        kind: "markdown",
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
