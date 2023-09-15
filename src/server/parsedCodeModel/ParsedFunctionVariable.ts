import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedFunction } from "./ParsedFunction";
import { ParsedParameter } from "./ParsedParameter";
import { ParsedVariable } from "./ParsedVariable";
import { BodyElement } from "./Types";
import { FindTypeReferenceLocationResult } from "./parsedCode";

export class ParsedFunctionVariable extends ParsedVariable {
  public function: ParsedFunction;
  private completionItem: CompletionItem = null;
  public element: BodyElement;

  public override createCompletionItem(select?: boolean): CompletionItem {
    if (this.completionItem === null) {
      const completionItem = CompletionItem.create(this.name);
      completionItem.kind = CompletionItemKind.Field;

      completionItem.detail =
        this.getElementInfo() + " (in " + this.function.name + ")";
      completionItem.documentation = {
        kind: "markdown",
        value: this.getInfo(true),
      };
      completionItem.preselect = select;
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
  public override getInfo(short?: boolean): string {
    const elemInfo = this.getElementInfo();
    return this.createSimpleDetail(
      !short && this.function.getRootName(),
      short ? "" : this.function.name,
      short ? elemInfo : `(): ${elemInfo}`,
      short ? "local" : undefined,
      !short,
      !short
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
    return this.type.getTypeSignature() + " " + (storageType || "") + this.name;
  }

  public getSignature(): string {
    return ParsedParameter.getParamInfo(this.element as any);
  }
}
