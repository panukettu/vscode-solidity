import { keccak256, toBytes } from "viem";
import * as vscode from "vscode-languageserver";
import { clearCaches } from "./caches";
import { ParsedDocument } from "./parsedCodeModel/ParsedDocument";
import { ParsedExpressionIdentifier } from "./parsedCodeModel/ParsedExpression";
import { ParsedFunction } from "./parsedCodeModel/ParsedFunction";
import { ParsedParameter } from "./parsedCodeModel/ParsedParameter";
import { CodeWalkerService } from "./parsedCodeModel/codeWalkerService";
import { ParsedCode } from "./parsedCodeModel/parsedCode";
import { ParsedStructVariable } from "./parsedCodeModel/ParsedStructVariable";
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

export const getFunction = (
  functionNames: string[],
  selectedDocment: ParsedDocument,
  item?: { name: string }
) => {
  if (!functionNames?.length) {
    throw new Error("No function names found");
  }

  const functionName = functionNames[functionNames.length - 1];

  let selectedVariable: ParsedParameter;
  let selectedFunction: ParsedFunction;
  let selectedIndex: number;
  let parameters: vscode.ParameterInformation[] = [];

  for (const contract of selectedDocment.getAllContracts()) {
    let selectedFunctions = contract.findMethodsInScope(
      functionName
    ) as ParsedFunction[];
    if (!selectedFunctions?.length) {
      selectedFunctions = contract.findMethodCalls(
        functionName
      ) as ParsedFunction[];
    }
    if (!selectedFunctions?.length) continue;

    selectedFunction = selectedFunctions[0];

    if (item) {
      const input = selectedFunction.input.find((inputVar, index) => {
        if (inputVar.name === item.name) {
          selectedIndex = index;
          return true;
        }
      });
      if (input) {
        parameters = selectedFunction.input.map((i) => {
          return {
            label: i.name,
            documentation: {
              kind: "markdown",
              value: i.getInfo(),
            },
          };
        });
        selectedVariable = input;
      }
    } else {
      break;
    }
  }

  return {
    selectedVariable,
    selectedFunction,
    selectedIndex,
    parameters,
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

      const { selectedVariable, selectedFunction, selectedIndex, parameters } =
        getFunction(functionNames, documentContractSelected, item);

      if (!selectedVariable) return null;

      const result = vscode.SignatureInformation.create(
        selectedVariable.getElementInfo()
      );

      // result.documentation = {
      //   kind: "markdown",
      //   value: selectedFunction.getComment(),
      // };

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
      const selectedFunction =
        documentContractSelected.getSelectedFunction(offset);
      const item = documentContractSelected.getSelectedItem(
        offset
      ) as ParsedExpressionIdentifier;
      if (!item) {
        reset();
        return null;
      }
      const res = item.getHover();
      // const inScope = selectedFunction.findTypeInScope(item.parent?.name);
      // console.debug(!!inScope);
      // @ts-expect-error
      if (!!res.contents?.value) {
        reset();

        return res;
      } else if (item.parent) {
        const parentMapping =
          // @ts-expect-error
          item.parent?.reference?.element?.literal?.literal?.to?.literal;
        const allFound = documentContractSelected.brute(item.name, true);

        if (allFound.length === 0) {
          reset();
          return null;
        }

        for (const found of allFound) {
          // @ts-expect-error
          if (found.struct && found.struct?.name === parentMapping) {
            const res = found.getHover();
            // @ts-expect-error
            if (!!res.contents?.value) {
              reset();
              return res;
            }
          } else {
            const parentInScope = selectedFunction.findTypeInScope(
              // @ts-expect-error
              found.parent?.name
            );
            if (!!parentInScope) {
              reset();
              return found.getHover();
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
    try {
      const offset = document.offsetAt(position);
      // walker.initialiseChangedDocuments();
      const documentContractSelected = walker.getSelectedDocument(
        document,
        position
      );

      this.currentItem = documentContractSelected.getSelectedItem(offset);
      providerRequest.selectedDocument = documentContractSelected;

      const references = documentContractSelected.getAllReferencesToSelected(
        offset,
        walker.parsedDocumentsCache
      );

      const foundLocations = references
        .filter((x) => x != null && x.location !== null)
        .map((x) => x.location);

      this.currentItem = null;
      providerRequest.selectedDocument = null;
      clearCaches();
      return <vscode.Location[]>foundLocations;
    } catch (e) {
      clearCaches();
      console.debug("ref", e);
    }
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
      // console.debug(this.currentItem);
      const references =
        documentContractSelected.getSelectedTypeReferenceLocation(
          this.currentOffset
        );
      // console.debug(references);
      const foundLocations = references
        .filter((x) => x.location !== null)
        .map((x) => x.location);
      const result = this.removeDuplicates(foundLocations, ["range", "uri"]);
      this.currentOffset = 0;
      this.currentItem = null;
      clearCaches();
      return <vscode.Location[]>result;
    } catch (e) {
      clearCaches();
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
