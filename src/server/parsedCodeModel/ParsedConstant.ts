import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedParameter } from "./ParsedParameter";
import { ParsedVariable } from "./ParsedVariable";
import { BodyElement } from "./Types";
import { ParsedDeclarationType } from "./parsedDeclarationType";

export class ParsedConstant extends ParsedVariable {
  public from: string;
  private completionItem: CompletionItem = null;
  public element: BodyElement;
  public override initialise(element: BodyElement, document: ParsedDocument) {
    super.initialise(element, document);
    this.name = element.name;
    this.type = ParsedDeclarationType.create(element.literal, null, document);
  }

  public override createCompletionItem(preselect?: boolean): CompletionItem {
    if (this.completionItem === null) {
      const completionItem = CompletionItem.create(this.name);
      completionItem.kind = CompletionItemKind.Field;
      completionItem.insertText = this.name;
      completionItem.detail = this.getElementInfo();
      completionItem.documentation = {
        kind: "markdown",
        value: this.getInfo(true),
      };
      completionItem.preselect = preselect;
      this.completionItem = completionItem;
    }
    return this.completionItem;
  }

  public override getParsedObjectType(): string {
    return "Constant";
  }

  public override getInfo(short?: boolean): string {
    const elemInfo = this.getElementInfo();
    return this.createSimpleDetail(
      !short && this.getRootName(),
      short ? "" : this.name,
      short ? elemInfo : `: ${elemInfo}`,
      short
        ? (this.getRootName() + " " + this.getParsedObjectType()).toLowerCase()
        : undefined,
      !short,
      !short
    );
  }
  public getElementInfo(): string {
    return this.type.getTypeSignature() + " " + this.name;
  }

  public getSignature(): string {
    return ParsedParameter.getParamInfo(this.element as any);
  }
}
