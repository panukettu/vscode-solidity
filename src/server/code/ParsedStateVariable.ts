import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { ParsedContract } from "./ParsedContract";
import { ParsedDeclarationType } from "./ParsedDeclarationType";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedVariable } from "./ParsedVariable";

export class ParsedStateVariable extends ParsedVariable {
  private completionItem: CompletionItem = null;

  public element: any;

  public initialise(
    element: any,
    document: ParsedDocument,
    contract: ParsedContract
  ) {
    super.initialise(element, document, contract);
    this.name = element.name;
    this.type = ParsedDeclarationType.create(
      element.literal,
      contract,
      document
    );
  }

  public createCompletionItem(): CompletionItem {
    if (this.completionItem === null) {
      const completionItem = CompletionItem.create(this.name);
      completionItem.kind = CompletionItemKind.Field;
      completionItem.documentation = this.getMarkupInfo();
      this.completionItem = completionItem;
    }
    return this.completionItem;
  }

  public override getParsedObjectType(): string {
    return "State Variable";
  }

  public override getInfo(): string {
    return this.createInfo(
      this.getRootName(),
      "",
      `${this.getElementInfo()}`,
      undefined,
      true,
      true
    );
  }
  public getElementInfo(): string {
    const storageType = this.getStorageType();

    return (
      this.name +
      ": " +
      this.type.getTypeSignature() +
      " " +
      (storageType || "")
    );
  }
  public getStorageType(space = true): string {
    let result = "";
    if (!!this.element?.storage_location) {
      result = this.element?.storage_location + (space ? " " : "");
    }
    return result;
  }
}
