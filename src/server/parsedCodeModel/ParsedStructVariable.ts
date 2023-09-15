import { CompletionItem } from "vscode-languageserver";
import { providerRequest } from "../definitionProvider";
import { ParsedCodeTypeHelper } from "./ParsedCodeTypeHelper";
import { ParsedCustomType } from "./ParsedCustomType";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedEnum } from "./ParsedEnum";
import { ParsedFunction } from "./ParsedFunction";
import { ParsedParameter } from "./ParsedParameter";
import { ParsedStruct } from "./ParsedStruct";
import { ParsedVariable } from "./ParsedVariable";
import { Element } from "./Types";
import { ParsedContract } from "./parsedContract";
import { ParsedDeclarationType } from "./parsedDeclarationType";

export class ParsedStructVariable extends ParsedVariable {
  public struct: ParsedStruct;
  private completionItem: CompletionItem = null;
  public abiType: string | null;
  public isContract: boolean = false;

  public properties: ParsedStructVariable[];
  public items: any[];

  public element: Element;

  public initialiseStructVariable(
    element: any,
    contract: ParsedContract,
    document: ParsedDocument,
    struct: ParsedStruct,
    typeRef?: ParsedStruct | ParsedEnum | ParsedCustomType
  ) {
    this.element = element;
    this.name = element.name;
    this.document = document;
    this.type = ParsedDeclarationType.create(
      element.literal,
      contract,
      document
    );

    this.struct = struct;

    if (typeRef instanceof ParsedStruct) {
      this.properties = typeRef.properties;
      this.abiType = `(${this.properties.map((p) => p.abiType).join(",")})`;
    } else if (typeRef instanceof ParsedEnum) {
      this.items = typeRef.items;
      this.abiType = "uint8" + this.type.getArraySignature();
    } else if (typeRef instanceof ParsedCustomType) {
      this.abiType = typeRef.isType + this.type.getArraySignature();
    } else {
      this.abiType = this.type.isValueType
        ? this.type.getTypeSignature()
        : null;

      if (!this.abiType) {
        const imports = this.document.sourceDocument.getAllImportFromPackages();
        if (imports.find((i) => i.indexOf(this.type.name) !== -1)) {
          this.abiType = "address" + this.type.getArraySignature();
          this.isContract = true;
        }
      }
    }
  }
  public createCompletionItem(): CompletionItem {
    if (this.completionItem === null) {
      const completitionItem = CompletionItem.create(this.name);
      completitionItem.documentation = this.getMarkupInfo();
      this.completionItem = completitionItem;
    }
    return this.completionItem;
  }

  public override getParsedObjectType(): string {
    return "Struct Property";
  }

  public getElementInfo(): string {
    let storageType = undefined;
    if (!this.type.isMapping && this.struct.hasMapping) {
      storageType = "storage";
    }

    // else if (providerRequest.selectedDocument) {
    //   const selectedFunction = this.getSelectedFunction(
    //     providerRequest.currentOffset
    //   );

    //   if (selectedFunction) {
    //     const parent = [
    //       ...selectedFunction.input,
    //       ...selectedFunction.output,
    //       ...selectedFunction.variables,
    //     ].find((i) => i.element.literal.literal === this.struct.name);
    //     if (parent) {
    //       storageType = parent.element.storage_location;
    //     }
    //   } else {
    //     const refs = providerRequest.selectedDocument
    //       .getAllReferencesToObject(this)
    //       .filter((r) => !!r?.reference) as any[];
    //     const found = refs.find(
    //       (t) => !!t?.reference?.parent?.reference?.element?.storage_location
    //     ) as ParsedCode | undefined;
    //     if (found) {
    //       // @ts-ignore
    //       const parent = found.reference.parent
    //         .reference as ParsedExpressionIdentifier;
    //       if (parent.parent) {
    //         const isSelected = parent.isElementedSelected(
    //           this.element,
    //           providerRequest.currentOffset
    //         );
    //         storageType = isSelected ? parent.element?.storage_location : "";
    //       }
    //     }
    //   }
    // }
    return (
      ParsedCodeTypeHelper.getTypeString(this.element.literal) +
      (storageType ? ` ${storageType}` : "")
    );
  }

  public getSelectedFunction(offset: number): ParsedFunction {
    let result: ParsedFunction | undefined;
    if (this.contract === null) {
      const allFuncs = this.document.getFunctionReference(offset);
      result = allFuncs.find(
        (f) => f?.reference.isCurrentElementedSelected(offset)
      )?.reference as ParsedFunction;
    } else {
      result = this.contract.getSelectedFunction(offset);
    }

    if (!result) {
      let paramArray: ParsedParameter[] = [];

      for (const inner of providerRequest.selectedDocument.innerContracts) {
        const inputs = inner
          .getAllFunctions()
          .map((f) => [...f.input, ...f.output, ...f.variables])
          .flatMap((f) => f)
          .filter((i) => i.element.literal.literal === this.struct.name);
        if (inputs.length > 0) paramArray = paramArray.concat(inputs as any);
      }
      for (const param of paramArray) {
        const foundFunc = param.getSelectedFunction(
          providerRequest.currentOffset
        );
        if (!!foundFunc?.name) return foundFunc;
      }
    }
    return result;
  }

  public override getInfo(): string {
    return this.createSimpleDetail(
      this.struct.getRootName(),
      this.struct.name,
      `.${this.name}: ${this.getElementInfo()}`,
      undefined,
      true,
      true
    );
  }
}
