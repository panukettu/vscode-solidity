import { FindTypeReferenceLocationResult, ParsedCode } from "./parsedCode";
import { ParsedDeclarationType } from "./parsedDeclarationType";

export class ParsedVariable extends ParsedCode {
  public type: ParsedDeclarationType;

  public override getSelectedTypeReferenceLocation(
    offset: number
  ): FindTypeReferenceLocationResult[] {
    if (this.isCurrentElementedSelected(offset)) {
      const foundType = this.type.findType();
      if (foundType !== undefined) {
        return [foundType.createFoundReferenceLocationResult()];
      }
      return [this.createFoundReferenceLocationResultNoLocation()];
    }
    return [this.createNotFoundReferenceLocationResult()];
  }

  public override getAllReferencesToObject(
    parsedCode: ParsedCode
  ): FindTypeReferenceLocationResult[] {
    if (this.isTheSame(parsedCode)) {
      return [this.createFoundReferenceLocationResult()];
    } else {
      return this.type.getAllReferencesToObject(parsedCode);
    }
  }
}
