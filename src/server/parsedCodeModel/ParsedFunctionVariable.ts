import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { ParsedCodeTypeHelper } from "./ParsedCodeTypeHelper";
import { ParsedFunction } from "./ParsedFunction";
import { ParsedVariable } from "./ParsedVariable";
import { FindTypeReferenceLocationResult } from "./parsedCode";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedParameter } from "./ParsedParameter";
import { BodyElement } from "./Types";

export class ParsedFunctionVariable extends ParsedVariable {
  public function: ParsedFunction;
  private completionItem: CompletionItem = null;
  public element: BodyElement;

  public override createCompletionItem(): CompletionItem {
    if (this.completionItem === null) {
      const completionItem = CompletionItem.create(this.name);
      completionItem.kind = CompletionItemKind.Field;
      let name = "";
      if (this.function.isGlobal) {
        name = this.document.getGlobalPathInfo();
      } else {
        name = this.function.contract.name;
      }
      const typeString = ParsedCodeTypeHelper.getTypeString(
        this.element.literal
      );
      completionItem.detail =
        "(Function variable in " +
        this.function.name +
        ") " +
        typeString +
        " " +
        name;
      this.completionItem = completionItem;
    }
    return this.completionItem;
  }

  public override getAllReferencesToThis(): FindTypeReferenceLocationResult[] {
    const results: FindTypeReferenceLocationResult[] = [];
    results.push(this.createFoundReferenceLocationResult());
    return results.concat(this.function.getAllReferencesToObject(this));
  }

  public override getAllReferencesToSelected(
    offset: number,
    documents: ParsedDocument[]
  ): FindTypeReferenceLocationResult[] {
    if (this.isCurrentElementedSelected(offset)) {
      if (this.type.isCurrentElementedSelected(offset)) {
        return this.type.getAllReferencesToSelected(offset, documents);
      } else {
        return this.getAllReferencesToThis();
      }
    }
    return [];
  }

  public override getParsedObjectType(): string {
    return "Func Variable";
  }
  public override getInfo(): string {
    return this.createSimpleDetail(
      this.function.getRootName(),
      this.function.name,
      `(): ${this.getElementInfo()}`,
      undefined,
      true,
      true
    );
    let parentInfo = this.getContractNameOrGlobal();
    let parentType = "";
    let parentName = "";
    const separator = parentInfo.indexOf(":");
    if (separator !== -1) {
      parentName = parentInfo.slice(separator + 1);
      parentType = parentInfo.slice(0, separator);
    }
    const typeInfo = this.type.getInfo();
    const typeName = this.type.name;
    const prefix = typeInfo.length > 15 ? "### " + typeName : typeInfo;
    const suffix =
      typeInfo.length > 15 ? "--- " + "\n" + "&nbsp;" + typeInfo : "";
    return (
      prefix +
      " " +
      this.name +
      "\n" +
      this.getParsedObjectType() +
      " in " +
      this.function.getParsedObjectType().toLowerCase() +
      " " +
      "**" +
      this.function.name +
      "**" +
      "\n" +
      "#### " +
      this.getContractNameOrGlobal() +
      "\n" +
      suffix
    );
  }

  public getStorageType(space = true): string {
    let result = "";
    if (this.element.storage_location) {
      result = this.element.storage_location + (space ? " " : "");
    }
    return result;
  }
  public getElementInfo(): string {
    const storageType = this.getStorageType();
    const array = this.type.isArray ? "[]" : "";
    return this.type.name + array + " " + (storageType || "") + this.name;
  }

  public getSignature(): string {
    return ParsedParameter.getParamInfo(this.element as any);
  }
}
