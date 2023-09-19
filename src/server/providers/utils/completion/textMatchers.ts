import * as vscode from "vscode-languageserver/node";
import { DotCompletionService } from "../../../code/utils/dotCompletionService";
import { isControl } from "../matchers";

const existingFuncRegexp = new RegExp(/(.*?\(.*?\))/s);
const innerImportRegexp = new RegExp(/(import\s\{)/s);
const emitRegexp = new RegExp(/(emit\s)/s);
const importRegexp = new RegExp(/(import\s)(?!\{)/s);
const fromRegexp = new RegExp(/(import\s\{.*?\}\sfrom)/s);
const symbolIdRegexp = new RegExp(/import\s\{(.*?)\W/s);
export const emitDotRegexp = /emit\s(\w+)\./g;

const mappingIdRegexp = /(\w+)(?=\[)/g;
const itemIdRegexp = /(\w+)(?=\()/g;
const isReplacingCallRegexp = new RegExp(/(.*?\(.*?\))/s);
const mappingIdsRegexpOld =
  /([a-zA-Z0-9_()]+)\[([^\]]*)\](?:\[([^\]]*)\])*(?!\.)(?=\;?$)/s;

const dotStartWordsRegexp = /(\w+)(?=\()/g;
const mappingStartWordsREgexp = /(\w+)(?=\[)/g;
const mappingWordsRegexp =
  /([a-zA-Z0-9_()]+)\[([^\]]*)\](?:\[([^\]]*)\])*(?!\.)(?=\;?$)/s;
// (\w+)(?<!function|modifier)\(?\)?\W(\w+)(?=\()

// const dotStartWordsRegexp = /(\w+)(?<![funcionmodier])\(?\)?\W(\w+)(?=\()/gm;

// line = lines[position.line];

// // const dotStartEz = textFromStart.lastIndexOf(".");
// triggeredByDotStart = DotCompletionService.getTriggeredByDotStart(
//   lines,
//   position
// );
// // triggered by emit is only possible with ctrl space
// const autoCompleteVariable = getAutocompleteVariableNameTrimmingSpaces(
//   line,
//   position.character - 1
// );

// triggeredByEmit =
//   autoCompleteVariable === "emit" || emitRegexp.test(line);
// triggeredByRevert = autoCompleteVariable === "revert";
// triggeredByInnerImport = innerImportRegexp.test(line);
// triggeredByFrom = fromRegexp.test(line);
// triggeredByInnerFrom =
//   autoCompleteVariable === "importInner" && triggeredByInnerImport;
export const getTriggers = (
  document: vscode.TextDocument,
  position: vscode.Position
) => {
  const triggers = {
    dotStart: 0,
    autoCompleteVariable: "",
    emit: false,
    revert: false,
    innerImport: false,
    searchFiles: false,
    import: false,
    from: false,
    innerFrom: false,
    symbolId: "",
  };
  const lines = document.getText().split(/\r?\n/g);
  const line = lines[position.line];
  triggers.dotStart = DotCompletionService.getTriggeredByDotStart(
    lines,
    position
  );
  // triggered by emit is only possible with ctrl space
  triggers.autoCompleteVariable = getAutocompleteVariableNameTrimmingSpaces(
    line,
    position.character - 1
  );

  triggers.emit =
    triggers.autoCompleteVariable === "emit" || emitRegexp.test(line);
  triggers.revert = triggers.autoCompleteVariable === "revert";
  triggers.innerImport = innerImportRegexp.test(line);
  triggers.from = fromRegexp.test(line);

  triggers.innerFrom =
    triggers.autoCompleteVariable === "importInner" && triggers.innerImport;

  if (!triggers.innerImport && !triggers.from) {
    triggers.import = importRegexp.test(line);
  }

  triggers.searchFiles =
    (!triggers.innerImport && (triggers.import || triggers.from)) ||
    triggers.innerFrom;

  const symbolIds = triggers.from ? symbolIdRegexp.exec(line) : "";
  triggers.symbolId = symbolIds?.length > 1 && symbolIds[1];
  return {
    triggers,
    line,
    lines,
  };
};

export const dotStartMatchers = (
  line: string,
  position: vscode.Position,
  triggeredByDotStart: number
) => {
  const textFromEnd = line.slice(position.character);
  const assignmentIndex = line.lastIndexOf("=");

  const textFromStart =
    assignmentIndex !== -1
      ? line.slice(assignmentIndex + 1, position.character + 1).trim()
      : line.slice(0, position.character + 1);
  const isReplacingCall = isReplacingCallRegexp.test(textFromEnd);

  const itemIds = textFromStart.match(itemIdRegexp);
  const itemIdsFiltered = itemIds?.length
    ? itemIds.filter((w) => !isControl(w))
    : [];
  const mappingIds = textFromStart.match(mappingIdRegexp);

  const isControlStatement = itemIdsFiltered?.length !== itemIds?.length;
  const functionParamsIndex = line.lastIndexOf("(");
  const functionsParamsIndexAssignment = line.lastIndexOf("(");
  const mappingParamsIndex = line.lastIndexOf("[");

  const dotInsideFuncParams =
    functionParamsIndex !== -1 && functionParamsIndex < triggeredByDotStart;

  const dotInsideMappingParams =
    mappingParamsIndex !== -1 && mappingParamsIndex < triggeredByDotStart;

  const mappingId = mappingIds?.length > 0 ? mappingIds[0] : null;

  const isMappingAccessor = textFromStart.indexOf("].") !== -1;
  const mappingParamIndex = textFromStart.split("[")?.length - 1;
  return {
    useCustomFunctionCompletion:
      itemIdsFiltered?.length > 1 && !dotInsideFuncParams,
    useCustomMappingCompletion:
      mappingIds?.length > 0 && !dotInsideMappingParams,
    isRegularStructMapping: mappingIds?.length > 0 && itemIds == null,
    dotInsideFuncParams,
    dotInsideMappingParams,
    useCustomFuncParamsCompletion:
      functionsParamsIndexAssignment > triggeredByDotStart &&
      itemIdsFiltered.length > 0,
    textFromEnd,
    textFromStart,
    isReplacingCall,
    itemIds,
    itemIdsFiltered,
    mappingIds,
    mappingId,
    isMappingAccessor,
    mappingParamIndex,
    isControlStatement,
  };
};

export function getAutocompleteVariableNameTrimmingSpaces(
  lineText: string,
  wordEndPosition: number
): string {
  let searching = true;
  let result = "";
  let quotesFound = false;
  if (lineText[wordEndPosition] === " ") {
    let spaceFound = true;
    while (spaceFound && wordEndPosition >= 0) {
      wordEndPosition = wordEndPosition - 1;
      if (lineText[wordEndPosition] !== " ") {
        spaceFound = false;
      }
    }
  }

  while (searching && wordEndPosition >= 0) {
    const currentChar = lineText[wordEndPosition];
    if (
      lineText[wordEndPosition] === '"' ||
      lineText[wordEndPosition] === "'"
    ) {
      quotesFound = true;
      return "importInner";
    }
    if (
      isAlphaNumeric(currentChar) ||
      currentChar === "_" ||
      currentChar === "$"
    ) {
      result = currentChar + result;
      wordEndPosition = wordEndPosition - 1;
    } else {
      if (currentChar === " ") {
        // we only want a full word for a variable // this cannot be parsed due incomplete statements
        searching = false;
        return result;
      }
      searching = false;
      return "";
    }
  }
  return result;
}

function isAlphaNumeric(str) {
  let code, i, len;

  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i);
    if (
      !(code > 47 && code < 58) && // numeric (0-9)
      !(code > 64 && code < 91) && // upper alpha (A-Z)
      !(code > 96 && code < 123)
    ) {
      // lower alpha (a-z)
      return false;
    }
  }
  return true;
}
export function isTriggeredByVariableName(
  variableName: string,
  lineText: string,
  wordEndPosition: number
): Boolean {
  const nameLength = variableName.length;
  if (
    wordEndPosition >= nameLength &&
    // does it equal our name?
    lineText.substr(wordEndPosition - nameLength, nameLength) === variableName
  ) {
    return true;
  }
  return false;
}
