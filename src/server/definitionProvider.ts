import { keccak256, toBytes } from "viem";
import * as vscode from "vscode-languageserver";
import { ParsedFunction } from "./parsedCodeModel/ParsedFunction";
import { ParsedParameter } from "./parsedCodeModel/ParsedParameter";
import { CodeWalkerService } from "./parsedCodeModel/codeWalkerService";
import { ParsedCode } from "./parsedCodeModel/parsedCode";
const keccak256Regexp = () => new RegExp(/(?<=keccak256\(")(.*?)(?="\))/g);

const nameRegexp = new RegExp(/(?<=\W)(\w+)(?=\()/gs);
export class SignatureHelpProvider {
  public provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.SignatureHelp | undefined {
    try {
      const offset = document.offsetAt(position);
      const documentContractSelected = walker.getSelectedDocument(
        document,
        position
      );
      const item = documentContractSelected.getSelectedItem(offset);
      const line = documentContractSelected.getLineRange(position.line);
      const currentExpression = document.getText(line);

      const functionNames = currentExpression.match(nameRegexp);

      let selectedVariable: ParsedParameter;
      let selectedFunction: ParsedFunction;
      let inputs: ParsedParameter[];
      let outputs: ParsedParameter[];
      let selectedIndex: number;

      if (functionNames?.length > 0) {
        const functionName = functionNames[functionNames.length - 1];
        for (const contract of documentContractSelected.getAllContracts()) {
          const selectedFunctions = contract.findMethodsInScope(
            functionName
          ) as ParsedFunction[];
          if (selectedFunctions?.length > 0) {
            selectedFunction = selectedFunctions[0];
            const input = selectedFunction.input.find((inputVar, index) => {
              if (inputVar.name === item.name) {
                selectedIndex = index;
                return true;
              }
            });
            const output = selectedFunction.output.find((inputVar, index) => {
              if (!input && inputVar.name === item.name) {
                selectedIndex = index;
                return true;
              }
            });
            if (input || output) {
              inputs = selectedFunction.input;
              outputs = selectedFunction.output;
              selectedVariable = input || output;
            }
            break;
          }
        }

        if (selectedVariable) {
          let result: vscode.SignatureInformation;
          const parameters = inputs;
          const paramInfos = parameters.map((i) =>
            vscode.ParameterInformation.create(
              i.name,
              i.type.getInfo().slice(4)
            )
          );
          result = vscode.SignatureInformation.create(
            "(" +
              selectedFunction.getContractNameOrGlobal() +
              ")" +
              "\n" +
              selectedFunction.name +
              "." +
              selectedVariable.name
          );

          result.parameters = paramInfos;
          result.activeParameter = selectedIndex;
          const signatureHelp: vscode.SignatureHelp = {
            activeParameter: selectedIndex,
            signatures: [result],
            activeSignature: 0,
          };
          return signatureHelp;
        }
      }
    } catch {
      return null;
    }
    return null;
  }
}
export class SolidityHoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.Hover | undefined {
    const offset = document.offsetAt(position);
    const documentContractSelected = walker.getSelectedDocument(
      document,
      position
    );

    const range = documentContractSelected.getLineRange(position.line);
    const text = document.getText(range);
    if (keccak256Regexp().test(text)) {
      return {
        contents: {
          kind: vscode.MarkupKind.Markdown,
          value: `### ${keccak256(toBytes(keccak256Regexp().exec(text)[0]))}`,
        },
      };
    } else {
      const item = documentContractSelected.getSelectedItem(offset);
      if (item !== null) {
        const res = item.getHover();
        return res;
      }
      return undefined;
    }
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

    SolidityReferencesProvider.currentItem =
      documentContractSelected.getSelectedItem(offset);

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
  public static provideReferenceLocations(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ) {
    const offset = document.offsetAt(position);
    walker.initialiseChangedDocuments();
    const documentContractSelected = walker.getSelectedDocument(
      document,
      position
    );

    SolidityReferencesProvider.currentItem =
      documentContractSelected.getSelectedItem(offset);

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

    const foundLocations = references.filter(
      (x) => x != null && x.location !== null
    );
    this.currentItem = null;
    return foundLocations;
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

export class SolidityDefinitionProvider {
  public static currentOffset: number = 0;
  public static currentItem: ParsedCode | null = null;

  public static provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.Location | vscode.Location[] {
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
    const keys = ["range", "uri"];
    const result = this.removeDuplicates(foundLocations, keys);
    this.currentOffset = 0;
    this.currentItem = null;

    return <vscode.Location[]>result;
  }
  public static provideDefinitionReference(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ) {
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
    const foundLocations = references.filter((x) => x.location !== null);
    this.currentOffset = 0;
    this.currentItem = null;

    return foundLocations;
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
