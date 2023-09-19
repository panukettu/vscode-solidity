import { isControl } from "../matchers";
import { getFunctionsByNameOffset } from "../functions";
import { ParsedDocument } from "../../../code/ParsedDocument";
import { ParsedCodeTypeHelper } from "../../../code/utils/ParsedCodeTypeHelper";
import { ParsedStructVariable } from "../../../code/ParsedStructVariable";
import { dotStartMatchers, emitDotRegexp, getTriggers } from "./textMatchers";
import * as vscode from "vscode-languageserver/node";
import { fileURLToPath } from "url";
import { relative } from "path";

import { CodeWalkerService } from "../../../code/walker/codeWalkerService";
import glob from "glob";
import { getImportPath, textEdit } from "./misc";
import * as path from "path";
import {
  GetCompletionTypes,
  GetCompletionKeywords,
  GeCompletionUnits,
  GetGlobalFunctions,
  GetGlobalVariables,
} from "./globals";
export const handleCustomFunctionCompletion = (
  document: ParsedDocument,
  offset: number,
  matchers: ReturnType<typeof dotStartMatchers>
) => {
  try {
    const items = getFunctionsByNameOffset(
      matchers.itemIdsFiltered,
      document,
      offset
    );
    if (!items?.length) {
      return handleDefault(document, offset);
    }

    const { relevantVars, relevantParams } =
      ParsedCodeTypeHelper.typesForFuncInput(
        offset,
        document.getSelectedFunction(offset),
        items[0]
      );
    return relevantVars
      .map((v) => v.createCompletionItem(true))
      .concat(relevantParams.map((v) => v.createFieldCompletionItem()));
  } catch (e) {
    // console.debug(e);

    return handleDefault(document, offset);
  }
};

export const handleCustomMappingCompletion = (
  document: ParsedDocument,
  offset: number,
  matchers: ReturnType<typeof dotStartMatchers>
) => {
  let mappingType: ParsedStructVariable | undefined;
  mappingType = document.findTypeInScope(
    matchers.mappingId
  ) as ParsedStructVariable;

  if (!mappingType) {
    const items = getFunctionsByNameOffset(
      matchers.itemIdsFiltered,
      document,
      offset
    );
    if (!items?.length) {
      return handleDefault(document, offset);
    }

    const innerFunc = items[0];
    mappingType = innerFunc.document.findTypeInScope(
      matchers.mappingId
    ) as ParsedStructVariable;
  }

  if (!mappingType) {
    return handleDefault(document, offset);
  }

  if (matchers.isMappingAccessor) {
    const { result, isValueType } =
      ParsedCodeTypeHelper.mappingOutType(mappingType);

    if (!isValueType) {
      const type = document.findTypeInScope(result);
      return type.getInnerCompletionItems();
    }
  }

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
};

export const handleDotEmit = (document: ParsedDocument, line: string) => {
  const emitDotResult = emitDotRegexp.exec(line);
  if (!emitDotResult?.length) return [];

  const emitFrom = emitDotResult[1];
  const contract = document.findContractByName(emitFrom);
  return contract.getAllEventsCompletionItems();
};

export const handleCustomMatchers = (
  completionItems: vscode.CompletionItem[],
  matchers: ReturnType<typeof dotStartMatchers>
) => {
  if (matchers.isReplacingCall) {
    return completionItems.map((c) => ({
      ...c,
      insertText: "",
    }));
  } else if (matchers.isControlStatement) {
    return completionItems.map((c) => ({
      ...c,
      insertText: c.insertText ? c.insertText.replace(";", "") : c.insertText,
    }));
  }

  return completionItems;
};

export const handleInnerImportCompletion = (
  walker: CodeWalkerService,
  completionItems: vscode.CompletionItem[],
  document: vscode.TextDocument,
  line: string,
  position: vscode.Position,
  triggers: ReturnType<typeof getTriggers>["triggers"]
) => {
  completionItems = completionItems.concat(
    ...walker.parsedDocumentsCache.map((d) => [
      ...d.getAllGlobalContractsCompletionItems(),
      ...d.getAllGlobalFunctionCompletionItems(),
      ...d.getAllGlobalStructsCompletionItems(),
      ...d.getAllGlobalConstantCompletionItems(),
    ])
  );
  // filter out duplicates
  completionItems = completionItems.filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.label === item.label)
  );
  const hasPreviousItems = line.indexOf(",") !== -1;
  const selectionStart = {
    line: position.line,
    character: hasPreviousItems ? line.indexOf(",") + 1 : line.indexOf("{") + 1,
  };
  const selectionEnd = {
    line: position.line,
    character: triggers.from ? line.length : line.indexOf("}") + 1,
  };
  // const range = vscode.Range.create(position, lineEnd);
  const editRange = vscode.Range.create(selectionStart, selectionEnd);
  const filePath = fileURLToPath(document.uri);
  const result = completionItems.map((i) => {
    if (!i.data?.absolutePath) return i;
    let rel = relative(filePath, i.data.absolutePath);
    rel = rel.split("\\").join("/");
    if (rel.startsWith("../")) {
      rel = rel.substr(1);
    }
    const prefix = hasPreviousItems ? " " : "";
    const importPath = i.data.remappedPath ?? rel;
    const replaced = i.insertText.includes("(")
      ? i.insertText.split("(")[0]
      : i.insertText;

    return {
      ...i,
      preselect: true,
      textEdit: vscode.InsertReplaceEdit.create(
        prefix + replaced + '} from "' + importPath + '";',
        editRange,
        editRange
      ),
    };
  });

  return result;
};

export const handleFileSearch = (
  walker: CodeWalkerService,
  completionItems: vscode.CompletionItem[],
  document: vscode.TextDocument,
  triggers: ReturnType<typeof getTriggers>["triggers"],
  line: ReturnType<typeof getTriggers>["line"],
  position: vscode.Position,
  rootPath: string
) => {
  const hasSourceDir = walker.resolvedSources !== "";
  const sourcesDir = "/" + walker.resolvedSources;
  const files = glob.sync(
    rootPath + (hasSourceDir ? sourcesDir : "") + "/**/*.sol"
  );
  const prefix = line[position.character] === '"' ? "" : '"';
  const fromIndex = line.indexOf('from "');
  const editRange = vscode.Range.create(
    {
      ...position,
      character:
        fromIndex !== -1 ? fromIndex + (prefix ? 5 : 6) : position.character,
    },
    {
      ...position,
      character: line.length,
    }
  );
  files.forEach((file) => {
    const dependencies = walker.project.libs.map((x) => path.join(rootPath, x));

    const [importPath, select] = getImportPath(
      file,
      dependencies,
      document,
      walker
    );

    const completionItem = vscode.CompletionItem.create(importPath);
    completionItem.textEdit = textEdit(importPath, editRange, prefix);
    completionItem.kind = vscode.CompletionItemKind.File;
    if (triggers.symbolId) {
      const doc = walker.parsedDocumentsCache.find(
        (d) => d.sourceDocument.absolutePath === file
      );

      if (doc) {
        const symbol = doc.findItem(triggers.symbolId);
        if (symbol) {
          completionItem.preselect = true;
          completionItem.detail = symbol.getContractNameOrGlobal();
          completionItem.kind = symbol.createCompletionItem().kind;
          completionItem.documentation = symbol.getMarkupInfo();
        }
      }
    } else if (select) {
      completionItem.preselect = select;
    }
    completionItems.push(completionItem);
  });
  return completionItems;
};

export const handleEmit = (document: ParsedDocument) => {
  if (document.selectedContract != null) {
    return document.selectedContract
      .getAllEventsCompletionItems()
      .concat(document.document.getAllGlobalContractsCompletionItems());
  } else {
    return document.getAllGlobalEventsCompletionItems();
  }
};

export const handleRevert = (document: ParsedDocument) => {
  if (document.selectedContract != null) {
    return document.selectedContract.getAllErrorsCompletionItems();
  } else {
    return document.getAllGlobalErrorsCompletionItems();
  }
};

export const handleDefault = (document: ParsedDocument, offset: number) => {
  if (document.selectedContract != null) {
    return document.selectedContract.getSelectedContractCompletionItems(offset);
  } else {
    return document.getSelectedDocumentCompletionItems(offset);
  }
};

export const handleFinally = () => {
  return GetCompletionTypes()
    .concat(GetCompletionKeywords())
    .concat(GeCompletionUnits())
    .concat(GetGlobalFunctions())
    .concat(GetGlobalVariables());
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
