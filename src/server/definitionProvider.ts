import { keccak256, toBytes } from "viem";
import * as vscode from "vscode-languageserver";
import { ParsedFunction } from "./parsedCodeModel/ParsedFunction";
import { ParsedParameter } from "./parsedCodeModel/ParsedParameter";
import { CodeWalkerService } from "./parsedCodeModel/codeWalkerService";
import { ParsedCode } from "./parsedCodeModel/parsedCode";
import { ParsedDocument } from "./parsedCodeModel/ParsedDocument";
import {
  ParsedExpression,
  ParsedExpressionIdentifier,
} from "./parsedCodeModel/ParsedExpression";
const keccak256Regexp = () => new RegExp(/(?<=keccak256\(")(.*?)(?="\))/g);

const nameRegexp = new RegExp(/(?<=\W)(\w+)(?=\()/gs);
const isComment = (text: string) => {
  const trimmed = text.trimStart();
  if (
    !trimmed.startsWith("///") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("*") &&
    !trimmed.startsWith("/**") &&
    !trimmed.startsWith("/*!") &&
    !trimmed.startsWith("*/")
  ) {
    return false;
  }
  return true;
};

export const providerRequest: {
  currentOffset: number;
  currentLine: number;
  lineText: string;
  position: vscode.Position;
  currentRange?: vscode.Range;
  selectedDocument?: ParsedDocument;
  action?: "definition" | "references" | "hover";
} = {
  currentOffset: 0,
  currentLine: 0,
  position: vscode.Position.create(0, 0),
  lineText: "",
};

const useHelper = (
  action: "definition" | "references" | "hover",
  document: vscode.TextDocument,
  position: vscode.Position,
  walker: CodeWalkerService
) => {
  const documentContractSelected = walker.getSelectedDocument(
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
      providerRequest.currentOffset = 0;
      providerRequest.currentLine = 0;
      providerRequest.lineText = "";
      providerRequest.position = vscode.Position.create(0, 0);
      providerRequest.currentRange = undefined;
      providerRequest.action = undefined;
    },
  };
};
export class SignatureHelpProvider {
  public provideSignatureHelp(
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
      const item = documentContractSelected.getSelectedItem(offset);
      const line = documentContractSelected.getLineRange(position.line);

      const functionNames = document.getText(line).match(nameRegexp);
      if (!functionNames?.length) return null;

      const functionName = functionNames[functionNames.length - 1];

      let selectedVariable: ParsedParameter;
      let selectedFunction: ParsedFunction;
      let selectedIndex: number;
      let parameters: vscode.ParameterInformation[] = [];

      for (const contract of documentContractSelected.getAllContracts()) {
        const selectedFunctions = contract.findMethodsInScope(
          functionName
        ) as ParsedFunction[];
        if (!selectedFunctions?.length) continue;

        selectedFunction = selectedFunctions[0];
        const input = selectedFunction.input.find((inputVar, index) => {
          if (inputVar.name === item.name) {
            selectedIndex = index;
            return true;
          }
        });
        if (input) {
          parameters = selectedFunction.input.map((i) =>
            vscode.ParameterInformation.create(
              i.name,
              i.type.getInfo().slice(4)
            )
          );
          selectedVariable = input;
          break;
        }
      }

      if (!selectedVariable) return null;

      const result = vscode.SignatureInformation.create(
        "(" +
          selectedFunction.getContractNameOrGlobal() +
          ")" +
          "\n" +
          selectedFunction.name +
          "." +
          selectedVariable.name
      );

      result.parameters = parameters;
      result.activeParameter = selectedIndex;
      return {
        activeParameter: selectedIndex,
        signatures: [result],
        activeSignature: 0,
      };
    } catch (e) {
      console.log("SignatureHelp", e.message);
      return null;
    }
  }
}
export class SolidityHoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.Hover | undefined {
    const { range, offset, documentContractSelected, reset } = useHelper(
      "hover",
      document,
      position,
      walker
    );

    const text = document.getText(range);
    if (keccak256Regexp().test(text)) {
      reset();
      return {
        contents: {
          kind: vscode.MarkupKind.Markdown,
          value: `### ${keccak256(toBytes(keccak256Regexp().exec(text)[0]))}`,
        },
      };
    } else if (isComment(text)) {
      reset();
      return null;
    } else if (documentContractSelected != null) {
      const item = documentContractSelected.getSelectedItem(
        offset
      ) as ParsedExpressionIdentifier;
      if (item !== null) {
        const res = item.getHover();
        // @ts-expect-error
        if (!!res.contents?.value) {
          reset();
          return res;
        } else {
          const allFound = documentContractSelected.brute(item.name, true);
          if (allFound.length > 0) {
            const res = allFound[0].getHover();
            // @ts-expect-error
            if (!!res.contents?.value) {
              reset();
              return res;
            }
          }
        }
      }
    }
    reset();
    return null;
  }
}

export class SolidityReferencesProvider {
  public static currentItem: ParsedCode | null = null;
  public static provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.Location[] {
    const offset = document.offsetAt(position);
    walker.initialiseChangedDocuments();
    const documentContractSelected = walker.getSelectedDocument(
      document,
      position
    );

    this.currentItem = documentContractSelected.getSelectedItem(offset);

    const references = documentContractSelected.getAllReferencesToSelected(
      offset,
      [].concat(
        documentContractSelected,
        walker.parsedDocumentsCache.filter(
          (d) =>
            d.sourceDocument.absolutePath !==
            documentContractSelected.sourceDocument.absolutePath
        )
      )
    );

    const foundLocations = references
      .filter((x) => x != null && x.location !== null)
      .map((x) => x.location);
    this.currentItem = null;
    return <vscode.Location[]>foundLocations;
  }
}

export class SolidityDefinitionProvider {
  public static currentOffset: number = 0;
  public static currentItem: ParsedCode | null = null;

  public static provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.Location | vscode.Location[] {
    try {
      this.currentOffset = document.offsetAt(position);
      const documentContractSelected = walker.getSelectedDocument(
        document,
        position
      );
      this.currentItem = documentContractSelected.getSelectedItem(
        this.currentOffset
      );

      const references =
        documentContractSelected.getSelectedTypeReferenceLocation(
          this.currentOffset
        );
      const foundLocations = references
        .filter((x) => x.location !== null)
        .map((x) => x.location);
      const result = this.removeDuplicates(foundLocations, ["range", "uri"]);
      this.currentOffset = 0;
      this.currentItem = null;

      return <vscode.Location[]>result;
    } catch (e) {
      this.currentOffset = 0;
      this.currentItem = null;
      console.debug("Definition", e);
      return null;
    }
  }

  public static removeDuplicates(foundLocations: any[], keys: string[]) {
    return Object.values(
      foundLocations.reduce((r, o: any) => {
        const key = keys.map((k) => o[k]).join("|");
        // tslint:disable-next-line:curly
        if (r[key]) r[key].condition = [].concat(r[key].condition, o.condition);
        // tslint:disable-next-line:curly
        else r[key] = { ...o };
        return r;
      }, {})
    );
  }
}
