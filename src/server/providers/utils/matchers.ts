export const keccak256Regexp = () =>
  new RegExp(/(?<=keccak256\(")(.*?)(?="\))/g);

export const nameRegexp = new RegExp(/(?<=\W)(\w+)(?=\()/gs);
export const isComment = (text: string) => {
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

export const commentFormatRegexp = new RegExp(/\s(\w.+)/, "s");

export const isLeavingFunctionParams = (text: string, index: number) => {
  return (
    text[index - 1] === "." ||
    text[index + 1] === "(" ||
    text[index - 1] === ")" ||
    text[index - 1] === ";"
  );
};

export const isControl = (text: string) => {
  return (
    text === "if" ||
    text === "require" ||
    text === "else" ||
    text === "for" ||
    text === "while" ||
    text === "do" ||
    text === "switch" ||
    text === "case" ||
    text === "default" ||
    text === "break" ||
    text === "continue" ||
    text === "return" ||
    text === "throw" ||
    text === "try" ||
    text === "catch" ||
    text === "finally" ||
    text === "delete" ||
    text === "revert"
  );
};

export const isInnerExpression = (line: string) => {
  return (
    line.indexOf("if") !== -1 ||
    line.indexOf("require") !== -1 ||
    line.indexOf("while") !== -1 ||
    line.indexOf("do") !== -1 ||
    line.indexOf("switch") !== -1 ||
    line.indexOf("case") !== -1 ||
    line.indexOf("default") !== -1 ||
    line.indexOf("try") !== -1 ||
    line.indexOf("catch") !== -1 ||
    line.indexOf("finally") !== -1
  );
};
