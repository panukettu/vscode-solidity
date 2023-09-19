import { isControl } from "../matchers";
import { getFunctionsByNameOffset } from "../functions";
import { ParsedDocument } from "../../../code/ParsedDocument";
import { ParsedCodeTypeHelper } from "../../../code/utils/ParsedCodeTypeHelper";
import { ParsedStructVariable } from "../../../code/ParsedStructVariable";
import { dotStartMatchers } from "./textMatchers";

export const handleCustomFunctionCompletion = (
  document: ParsedDocument,
  offset: number,
  matchers: ReturnType<typeof dotStartMatchers>
) => {
  const items = getFunctionsByNameOffset(
    matchers.itemIdsFiltered,
    document,
    offset
  );
  if (!items?.length) throw new Error("no function found");

  const { relevantVars, relevantParams } =
    ParsedCodeTypeHelper.typesForFuncInput(
      offset,
      document.getSelectedFunction(offset),
      items[0]
    );
  return relevantVars
    .map((v) => v.createCompletionItem(true))
    .concat(relevantParams.map((v) => v.createFieldCompletionItem()));
};

export const handleCustomMappingCompletion = (
  document: ParsedDocument,
  offset: number,
  matchers: ReturnType<typeof dotStartMatchers>
) => {
  const items = getFunctionsByNameOffset(
    matchers.itemIdsFiltered,
    document,
    offset
  );
  if (!items?.length) throw new Error("no function found");
  const innerFunc = items[0];
  const mappingType = innerFunc.document.findTypeInScope(
    matchers.mappingId
  ) as ParsedStructVariable;

  if (mappingType) {
    if (matchers.isMappingAccessor) {
      const { result, isValueType } =
        ParsedCodeTypeHelper.mappingOutType(mappingType);

      if (!isValueType) {
        const type = innerFunc.document.findTypeInScope(result);
        return type.getInnerCompletionItems();
      }
    } else {
      const { relevantVars, relevantParams } =
        ParsedCodeTypeHelper.typesForMappingInput(
          offset,
          document.getSelectedFunction(offset),
          mappingType,
          matchers.mappingParamIndex
        );

      return relevantVars
        .map((v) => v.createCompletionItem(true))
        .concat(relevantParams.map((v) => v.createFieldCompletionItem()));
    }
  }
};

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
