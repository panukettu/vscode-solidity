import * as vscode from "vscode-languageserver/node";
import { ProviderRequestHelp } from "../../types";
import { clearCaches } from "./caches";
import { CodeWalkerService } from "../../code/walker/codeWalkerService";
import { documents } from "../../../server";
import { getCodeWalkerService } from "../../utils";
export const providerRequest: ProviderRequestHelp = {
  currentOffset: 0,
  currentLine: 0,
  position: vscode.Position.create(0, 0),
  lineText: "",
};

export const useProviderHelper = (
  action: "definition" | "references" | "hover",
  document: vscode.TextDocument,
  position: vscode.Position,
  walker: CodeWalkerService
) => {
  const documentContractSelected = walker.getSelectedDocumentProfiler(
    document,
    position
  );

  const range = documentContractSelected.getLineRange(position.line);
  const offset = document.offsetAt(position);
  const text = document.getText(range);
  providerRequest.currentOffset = offset;
  providerRequest.currentLine = position.line;
  providerRequest.currentRange = range;
  providerRequest.position = position;
  providerRequest.action = action;
  providerRequest.selectedDocument = documentContractSelected;
  providerRequest.lineText = text;
  return {
    documentContractSelected,
    range,
    offset,
    reset: () => {
      clearCaches();
      providerRequest.currentOffset = 0;
      providerRequest.currentLine = 0;
      providerRequest.lineText = "";
      providerRequest.position = vscode.Position.create(0, 0);
      providerRequest.currentRange = undefined;
      providerRequest.action = undefined;
    },
  };
};

export const providerParams = (
  handler: any
): [vscode.TextDocument, vscode.Position, CodeWalkerService] => {
  return [
    documents.get(handler.textDocument.uri),
    handler.position,
    getCodeWalkerService(),
  ];
};
