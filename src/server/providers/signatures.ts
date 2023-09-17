import * as vscode from "vscode-languageserver/node";
import { CodeWalkerService } from "../code/walker/codeWalkerService";
import { isLeavingFunctionParams, nameRegexp } from "./utils/matchers";
import { findByParam, getFunctionsByNameOffset } from "./utils/functions";

export class SignatureHelpProvider {
  public static provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.SignatureHelp | undefined {
    try {
      const documentContractSelected = walker.getSelectedDocument(
        document,
        position
      );
      const offset = document.offsetAt(position);
      const line = documentContractSelected.getLineRange(position.line);
      const text = document.getText(line);
      const functionNames = text.match(nameRegexp);

      if (
        !functionNames?.length ||
        isLeavingFunctionParams(text, position.character)
      )
        return null;
      const index =
        text
          .slice(
            text.indexOf(functionNames[functionNames.length - 1]),
            position.character
          )
          .split(",").length - 1;
      const functionsFound = getFunctionsByNameOffset(
        functionNames,
        documentContractSelected,
        offset
      );

      const skipSelf = functionNames.length === 2 || functionNames.length === 4;
      const { parameters, inputs, selectedFunction } = findByParam(
        functionsFound,
        index,
        undefined,
        skipSelf
      );
      if (!parameters?.length) return null;
      const activeParameter = Math.min(index, parameters.length - 1);

      const result = vscode.SignatureInformation.create(
        inputs[activeParameter].getSignatureInfo(activeParameter, skipSelf)
      );
      result.parameters = parameters;
      result.activeParameter = activeParameter;

      return {
        activeParameter: result.activeParameter,
        signatures: [result],
        activeSignature: 0,
      };
    } catch (e) {
      console.debug("SignatureHelp", e);
      return null;
    }
  }
}
