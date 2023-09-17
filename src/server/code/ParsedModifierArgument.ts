import { TypeReference } from "../search/TypeReference";
import { ParsedCode } from "./ParsedCode";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedFunction } from "./ParsedFunction";

export class ParsedModifierArgument extends ParsedCode {
  public functionParent: ParsedFunction;
  public params: any;

  public initialiseModifier(
    element: any,
    functionParent: ParsedFunction,
    document: ParsedDocument
  ) {
    this.functionParent = functionParent;
    this.contract = functionParent.contract;
    this.element = element;
    this.name = element.name;
    this.document = document;
  }

  public isPublic(): boolean {
    return this.name === "public";
  }

  public isPrivate(): boolean {
    return this.name === "private";
  }

  public isExternal(): boolean {
    return this.name === "external";
  }

  public isInternal(): boolean {
    return this.name === "internal";
  }
  public isOverride(): boolean {
    return this.name === "override";
  }

  public isPure(): boolean {
    return this.name === "pure";
  }

  public isView(): boolean {
    return this.name === "view";
  }
  public isVirtual(): boolean {
    return this.name === "virtual";
  }

  public isPayeable(): boolean {
    return this.name === "payable";
  }

  public IsCustomModifier(): boolean {
    return !(
      this.isPublic() ||
      this.isExternal() ||
      this.isPrivate() ||
      this.isView() ||
      this.isPure() ||
      this.isPayeable() ||
      this.isVirtual() ||
      this.isOverride() ||
      this.isInternal()
    );
  }

  public getSelectedTypeReferenceLocation(offset: number): TypeReference[] {
    if (this.isCurrentElementedSelected(offset)) {
      const results: TypeReference[] = [];
      if (this.IsCustomModifier()) {
        const foundResults = this.findMethodsInScope(this.name);
        if (foundResults.length > 0) {
          foundResults.forEach((x) => {
            results.push(TypeReference.create(true, x.getLocation()));
          });
        }
        return results;
      }
      return [TypeReference.create(true)];
    }
    return [TypeReference.create(false)];
  }

  public getAllReferencesToObject(parsedCode: ParsedCode): TypeReference[] {
    if (this.IsCustomModifier()) {
      if (parsedCode instanceof ParsedFunction) {
        const functModifider = <ParsedFunction>parsedCode;
        if (functModifider.isModifier && functModifider.name === this.name) {
          return [this.createFoundReferenceLocationResult()];
        }
      }
    }
    return [];
  }

  public override getAllReferencesToSelected(
    offset: number,
    documents: ParsedDocument[]
  ): TypeReference[] {
    if (this.isCurrentElementedSelected(offset)) {
      let results: TypeReference[] = [];
      if (this.IsCustomModifier()) {
        const foundResults = this.findMethodsInScope(this.name);
        foundResults.forEach(
          (x) => (results = results.concat(x.getAllReferencesToThis(documents)))
        );
        return results;
      }
    }
    return [];
  }

  public override getParsedObjectType(): string {
    return "Modifier Argument";
  }

  public override getInfo(): string {
    if (this.IsCustomModifier()) {
      const foundResults = this.findMethodsInScope(
        this.name
      ) as ParsedFunction[];
      if (foundResults.length > 0) {
        return foundResults[0].getInfo();
      }

      return (
        "### " +
        this.getParsedObjectType() +
        ": " +
        this.name +
        "\n" +
        "#### " +
        this.functionParent.getParsedObjectType() +
        ": " +
        this.functionParent.name +
        "\n" +
        "#### " +
        this.getContractNameOrGlobal() +
        "\n"
      );
    }
  }
}
