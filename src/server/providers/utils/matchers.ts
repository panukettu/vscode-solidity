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
    text === "new" ||
    text === "delete" ||
    text === "revert"
  );
};
