import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedFunction } from "./ParsedFunction";
import { ParsedParameter } from "./ParsedParameter";
import { ParsedVariable } from "./ParsedVariable";
import { BodyElement } from "./types";
import { TypeReference } from "../search/TypeReference";

export class ParsedFunctionVariable extends ParsedVariable {
  public function: ParsedFunction;
  private completionItem: CompletionItem = null;
  public element: BodyElement;

  public override createCompletionItem(select?: boolean): CompletionItem {
    if (this.completionItem === null) {
      const completionItem = CompletionItem.create(this.name);
      completionItem.kind = CompletionItemKind.Field;
      completionItem.detail = `${this.function.name}.${this.name}`;
      completionItem.documentation = {
        kind: "markdown",
        value: this.getShortInfo(true),
      };
      completionItem.preselect = select;
      this.completionItem = completionItem;
    }
    return this.completionItem;
  }

  public override getAllReferencesToThis(): TypeReference[] {
    const results: TypeReference[] = [];
    results.push(this.createFoundReferenceLocationResult());
    return results.concat(this.function.getAllReferencesToObject(this));
  }

  public override getAllReferencesToSelected(
    offset: number,
    documents: ParsedDocument[]
  ): TypeReference[] {
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
    return "Local Variable";
  }
  public override getInfo(comments?: boolean): string {
    const elemInfo = this.getElementInfo();
    const hasInputs = this.function.input.length > 0;
    return this.createInfo(
      this.function.getRootName(),
      this.function.name,
      (hasInputs ? "(...): " : `(): `) + `${elemInfo}`,
      undefined,
      comments,
      comments
    );
  }
  public override getShortInfo(comments?: boolean): string {
    const elemInfo = this.getElementInfo();
    return this.createShortInfo("", elemInfo, comments, comments, "(local)");
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
