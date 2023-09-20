"use strict";
import * as vscode from "vscode-languageserver";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { DotCompletionService } from "../code/utils/dotCompletionService";
import { CodeWalkerService } from "../code/walker/codeWalkerService";
import { getGlobalKeywordCompletions } from "./utils/completion/globals";
import {
  handleCustomFunctionCompletion,
  handleCustomMappingCompletion,
  handleCustomMatchers,
  handleDefault,
  handleDotEmit,
  handleEmit,
  handleFileSearch,
  handleFinally,
  handleInnerImportCompletion,
  handleRevert,
} from "./utils/completion/handlers";
import { dotStartMatchers, getTriggers } from "./utils/completion/textMatchers";

export class CompletionService {
  public rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  public getAllCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): CompletionItem[] {
    let completionItems: CompletionItem[] = [];

    try {
      const offset = document.offsetAt(position);

      const documentContractSelected = walker.getSelectedDocumentProfiler(
        document,
        position
      );

      const trigs = getTriggers(document, position);

      let triggers = trigs.triggers;
      // console.debug(triggers);
      if (triggers.declaration) return [];
      //  TODO: this does not work due to the trigger.
      // || (lines[position.line].trimLeft().startsWith('import "') && lines[position.line].trimLeft().lastIndexOf('"') === 7);

      if (triggers.dotStart > 0) {
        // console.debug("dot handler");
        try {
          const matchers = dotStartMatchers(
            trigs.line,
            position,
            triggers.dotStart
          );
          const globals = getGlobalKeywordCompletions(
            trigs.line,
            position.character - 1
          );
          // console.debug(matchers);
          if (globals != null) {
            // console.debug("global handler");
            completionItems = completionItems.concat(globals);
          } else if (
            matchers.useCustomFunctionCompletion ||
            matchers.useCustomFuncParamsCompletion
          ) {
            // console.debug("custom func handler");
            try {
              completionItems = completionItems.concat(
                handleCustomFunctionCompletion(
                  documentContractSelected,
                  offset,
                  position,
                  matchers,
                  trigs
                )
              );
            } catch (e) {
              // console.debug("custom-func-completion", e.message);
            }
          } else if (matchers.useCustomMappingCompletion) {
            // console.debug("custom mapping handler");
            completionItems = completionItems.concat(
              handleCustomMappingCompletion(
                documentContractSelected,
                offset,
                position,
                matchers,
                trigs
              )
            );
          } else {
            if (triggers.emit) {
              // console.debug("custom emit handler");
              completionItems = completionItems.concat(
                handleDotEmit(documentContractSelected, trigs.line)
              );
            }
            // console.debug("dot handler");
            completionItems = completionItems.concat(
              DotCompletionService.getSelectedDocumentDotCompletionItems(
                trigs.lines,
                position,
                triggers.dotStart,
                documentContractSelected,
                offset
              )
            );
          }
          // console.debug("custom matchers return");
          return handleCustomMatchers(completionItems, matchers);
        } catch (e) {
          // console.debug("dot handler", e);
        }
      } else {
        // console.debug("outside dot");
        if (triggers.searchFiles) {
          // console.debug("file search handler");
          return handleFileSearch(
            walker,
            completionItems,
            document,
            trigs,
            position,
            this.rootPath
          );
        } else if (triggers.innerImport) {
          // console.debug("inner import handler");
          try {
            return handleInnerImportCompletion(
              walker,
              completionItems,
              document,
              trigs.line,
              position,
              triggers
            );
          } catch (e) {
            // console.debug("trigger-inner-import", e);
          }
        } else if (triggers.emit) {
          // console.debug("emit handler");
          completionItems = completionItems.concat(
            handleEmit(documentContractSelected)
          );
        } else if (triggers.revert) {
          // console.debug("rever handler");
          completionItems = completionItems.concat(
            handleRevert(documentContractSelected)
          );
        } else {
          // console.debug("default handler");
          completionItems = completionItems.concat(
            handleDefault(documentContractSelected, offset)
          );
        }
      }
    } catch (e) {
      // console.debug("completion catch", e);
    } finally {
      // console.debug("finally handler");
      completionItems = completionItems.concat(handleFinally());
    }

    return completionItems;
  }
}

export function CreateCompletionItem(
  label: string,
  kind: CompletionItemKind,
  detail: string
) {
  const completionItem = CompletionItem.create(label);
  completionItem.kind = kind;
  completionItem.detail = detail;
  return completionItem;
}
