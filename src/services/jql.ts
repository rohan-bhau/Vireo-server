type TokenType =
  | "FIELD" | "OPERATOR" | "VALUE" | "STRING" | "NUMBER"
  | "FUNCTION" | "AND" | "OR" | "NOT"
  | "LPAREN" | "RPAREN"
  | "ORDER_BY" | "ASC" | "DESC" | "COMMA"
  | "EOF";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

interface JqlCondition {
  field: string;
  operator: string;
  value: string | string[] | number | null;
  operatorRaw: string;
}

interface JqlNode {
  type: "condition" | "group" | "not";
  condition?: JqlCondition;
  operator?: "AND" | "OR";
  left?: JqlNode;
  right?: JqlNode;
}

interface OrderByClause {
  field: string;
  direction: "ASC" | "DESC";
}

interface ParseResult {
  tree: JqlNode | null;
  orderBy: OrderByClause[];
  error: { message: string; position: number } | null;
}

const FIELD_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*/;
const OPERATOR_MAP: Record<string, string> = {
  "=": "equals",
  "!=": "not_equals",
  ">": "greater_than",
  ">=": "greater_than_or_equal",
  "<": "less_than",
  "<=": "less_than_or_equal",
  "~": "contains",
  "!~": "not_contains",
  "IN": "in",
  "NOT IN": "not_in",
  "IS": "is",
  "IS NOT": "is_not",
};

const FIELD_MAP: Record<string, string> = {
  project: "projectId",
  type: "type",
  issuetype: "type",
  status: "status",
  assignee: "assignee",
  reporter: "reporter",
  priority: "priority",
  labels: "labels",
  component: "component",
  fixversion: "fixVersion",
  sprint: "sprintId",
  created: "createdAt",
  updated: "updatedAt",
  due: "dueDate",
  summary: "title",
  description: "description",
  text: "title",
  storypoints: "storyPoints",
  parent: "parentTask",
};

function tokenize(input: string): { tokens: Token[]; error: { message: string; position: number } | null } {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    if (input[i] === " " || input[i] === "\t" || input[i] === "\n") {
      i++;
      continue;
    }

    if (input[i] === "(") {
      tokens.push({ type: "LPAREN", value: "(", pos: i });
      i++;
      continue;
    }

    if (input[i] === ")") {
      tokens.push({ type: "RPAREN", value: ")", pos: i });
      i++;
      continue;
    }

    if (input[i] === ",") {
      tokens.push({ type: "COMMA", value: ",", pos: i });
      i++;
      continue;
    }

    if (input[i] === '"') {
      const start = i;
      i++;
      let val = "";
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < input.length) {
          i++;
          val += input[i];
        } else {
          val += input[i];
        }
        i++;
      }
      if (i >= input.length) {
        return { tokens, error: { message: "Unterminated string literal", position: start } };
      }
      i++;
      tokens.push({ type: "VALUE", value: val, pos: start });
      continue;
    }

    if (input[i] === "'") {
      const start = i;
      i++;
      let val = "";
      while (i < input.length && input[i] !== "'") {
        val += input[i];
        i++;
      }
      if (i >= input.length) {
        return { tokens, error: { message: "Unterminated string literal", position: start } };
      }
      i++;
      tokens.push({ type: "VALUE", value: val, pos: start });
      continue;
    }

    if (input[i] === "-" && i + 1 < input.length && input[i + 1] >= "0" && input[i + 1] <= "9") {
      const start = i;
      i++;
      let num = "-";
      while (i < input.length && input[i] >= "0" && input[i] <= "9") {
        num += input[i];
        i++;
      }
      if (i < input.length && input[i] === ".") {
        num += ".";
        i++;
        while (i < input.length && input[i] >= "0" && input[i] <= "9") {
          num += input[i];
          i++;
        }
      }
      tokens.push({ type: "NUMBER", value: num, pos: start });
      continue;
    }

    if (input[i] >= "0" && input[i] <= "9") {
      const start = i;
      let num = "";
      while (i < input.length && input[i] >= "0" && input[i] <= "9") {
        num += input[i];
        i++;
      }
      if (i < input.length && input[i] === ".") {
        num += ".";
        i++;
        while (i < input.length && input[i] >= "0" && input[i] <= "9") {
          num += input[i];
          i++;
        }
      }
      tokens.push({ type: "NUMBER", value: num, pos: start });
      continue;
    }

    if (input[i] === "=") {
      tokens.push({ type: "OPERATOR", value: "=", pos: i });
      i++;
      continue;
    }

    if (input[i] === "!" && i + 1 < input.length) {
      if (input[i + 1] === "=") {
        tokens.push({ type: "OPERATOR", value: "!=", pos: i });
        i += 2;
        continue;
      }
      if (input[i + 1] === "~") {
        tokens.push({ type: "OPERATOR", value: "!~", pos: i });
        i += 2;
        continue;
      }
    }

    if (input[i] === ">") {
      if (i + 1 < input.length && input[i + 1] === "=") {
        tokens.push({ type: "OPERATOR", value: ">=", pos: i });
        i += 2;
      } else {
        tokens.push({ type: "OPERATOR", value: ">", pos: i });
        i++;
      }
      continue;
    }

    if (input[i] === "<") {
      if (i + 1 < input.length && input[i + 1] === "=") {
        tokens.push({ type: "OPERATOR", value: "<=", pos: i });
        i += 2;
      } else {
        tokens.push({ type: "OPERATOR", value: "<", pos: i });
        i++;
      }
      continue;
    }

    if (input[i] === "~") {
      tokens.push({ type: "OPERATOR", value: "~", pos: i });
      i++;
      continue;
    }

    const wordMatch = input.slice(i).match(FIELD_REGEX);
    if (wordMatch) {
      const start = i;
      const word = wordMatch[0];
      const upper = word.toUpperCase();
      i += word.length;

      if (upper === "AND") {
        tokens.push({ type: "AND", value: "AND", pos: start });
      } else if (upper === "OR") {
        tokens.push({ type: "OR", value: "OR", pos: start });
      } else if (upper === "NOT") {
        tokens.push({ type: "NOT", value: "NOT", pos: start });
      } else if (upper === "ORDER") {
        const rest = input.slice(i).match(/^\s+BY\b/i);
        if (rest) {
          tokens.push({ type: "ORDER_BY", value: "ORDER BY", pos: start });
          i += rest[0].length;
        } else {
          tokens.push({ type: "FIELD", value: word, pos: start });
        }
      } else if (upper === "BY") {
        continue;
      } else if (upper === "ASC") {
        tokens.push({ type: "ASC", value: "ASC", pos: start });
      } else if (upper === "DESC") {
        tokens.push({ type: "DESC", value: "DESC", pos: start });
      } else if (upper === "IN" || upper === "NOT") {
        if (upper === "NOT" && i + 3 < input.length) {
          const nextWord = input.slice(i).match(/^\s+IN\b/i);
          if (nextWord) {
            tokens.push({ type: "OPERATOR", value: "NOT IN", pos: start });
            i += nextWord[0].length;
          } else {
            tokens.push({ type: "NOT", value: "NOT", pos: start });
          }
        } else if (upper === "IN" && i + 2 < input.length) {
          const rest = input.slice(i).match(/^\s+\(/);
          if (rest) {
            tokens.push({ type: "OPERATOR", value: "IN", pos: start });
          } else {
            tokens.push({ type: "FIELD", value: word, pos: start });
          }
        } else {
          tokens.push({ type: "FIELD", value: word, pos: start });
        }
      } else if (upper === "IS") {
        const rest = input.slice(i).match(/^\s+NOT\b/i);
        if (rest) {
          tokens.push({ type: "OPERATOR", value: "IS NOT", pos: start });
          i += rest[0].length;
        } else {
          tokens.push({ type: "OPERATOR", value: "IS", pos: start });
        }
      } else if (i < input.length && input[i] === "(") {
        tokens.push({ type: "FUNCTION", value: word, pos: start });
      } else {
        if (upper === "EMPTY" && tokens.length > 0 && tokens[tokens.length - 1].value === "IS") {
          tokens.push({ type: "VALUE", value: "EMPTY", pos: start });
        } else if (upper === "NULL" && tokens.length > 0 && ["IS", "IS NOT"].includes(tokens[tokens.length - 1].value)) {
          tokens.push({ type: "VALUE", value: "NULL", pos: start });
        } else {
          tokens.push({ type: "FIELD", value: word, pos: start });
        }
      }
      continue;
    }

    return { tokens, error: { message: `Unexpected character '${input[i]}'`, position: i } };
  }

  tokens.push({ type: "EOF", value: "", pos: i });
  return { tokens, error: null };
}

function resolveField(field: string): string {
  return FIELD_MAP[field.toLowerCase()] || field;
}

function resolveFunction(name: string, args: string[], userId?: string): any {
  switch (name.toLowerCase()) {
    case "currentuser":
      return userId || "__currentUser__";
    case "now":
      return new Date();
    case "startofday":
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    case "endofday":
      const d2 = new Date();
      d2.setHours(23, 59, 59, 999);
      return d2;
    case "startofweek":
      const dw = new Date();
      const day = dw.getDay();
      const diff = dw.getDate() - day + (day === 0 ? -6 : 1);
      dw.setDate(diff);
      dw.setHours(0, 0, 0, 0);
      return dw;
    case "endofweek":
      const dw2 = new Date();
      const day2 = dw2.getDay();
      const diff2 = dw2.getDate() - day2 + (day2 === 0 ? 0 : 7);
      dw2.setDate(diff2);
      dw2.setHours(23, 59, 59, 999);
      return dw2;
    case "startofmonth":
      const dm = new Date();
      dm.setDate(1);
      dm.setHours(0, 0, 0, 0);
      return dm;
    case "endofmonth":
      const dm2 = new Date();
      dm2.setMonth(dm2.getMonth() + 1);
      dm2.setDate(0);
      dm2.setHours(23, 59, 59, 999);
      return dm2;
    case "membersof":
      return { $membersOf: args[0] };
    default:
      return name + "()";
  }
}

function parseTokens(tokens: Token[], userId?: string): { tree: JqlNode | null; orderBy: OrderByClause[]; error: { message: string; position: number } | null } {
  let pos = 0;
  const orderBy: OrderByClause[] = [];

  function peek(): Token {
    return tokens[pos] || { type: "EOF", value: "", pos: -1 };
  }

  function consume(type?: TokenType): Token {
    const t = tokens[pos] || { type: "EOF", value: "", pos: -1 };
    if (type && t.type !== type && t.type !== "EOF") {
      return t;
    }
    pos++;
    return t;
  }

  function parseValue(): string | string[] | number | null {
    const t = peek();
    if (t.type === "VALUE") {
      consume();
      return t.value;
    }
    if (t.type === "NUMBER") {
      consume();
      return parseFloat(t.value);
    }
    if (t.type === "FUNCTION") {
      const funcName = t.value;
      consume();
      consume("LPAREN");
      const args: string[] = [];
      while (peek().type !== "RPAREN" && peek().type !== "EOF") {
        const arg = parseValue();
        if (arg !== null) args.push(String(arg));
        if (peek().type === "COMMA") consume();
      }
      consume("RPAREN");
      return resolveFunction(funcName, args, userId);
    }
    if (t.type === "FIELD") {
      consume();
      if (t.value.toUpperCase() === "EMPTY" || t.value.toUpperCase() === "NULL") {
        return t.value.toUpperCase() === "EMPTY" ? "EMPTY" : null;
      }
      return t.value;
    }
    if (t.type === "LPAREN") {
      consume();
      const values: string[] = [];
      while (peek().type !== "RPAREN" && peek().type !== "EOF") {
        const v = parseValue();
        if (v !== null) values.push(String(v));
        if (peek().type === "COMMA") consume();
      }
      consume("RPAREN");
      return values;
    }
    return null;
  }

  function parseCondition(): JqlNode | null {
    const fieldToken = peek();
    if (fieldToken.type === "LPAREN") {
      consume();
      const node = parseOr();
      consume("RPAREN");
      return node || { type: "condition" as const };
    }
    if (fieldToken.type === "NOT") {
      consume();
      const inner = parseCondition();
      if (inner) {
        return { type: "not", operator: "AND", right: inner } as JqlNode;
      }
      return null;
    }
    if (fieldToken.type !== "FIELD" && fieldToken.type !== "FUNCTION" && fieldToken.type !== "VALUE") {
      return null;
    }

    if (fieldToken.type === "FUNCTION") {
      const val = parseValue();
      const op = peek();
      if (op.type === "OPERATOR") {
        consume();
        const value = parseValue();
        return {
          type: "condition",
          condition: {
            field: fieldToken.value,
            operator: OPERATOR_MAP[op.value] || "equals",
            value: value ?? null,
            operatorRaw: op.value,
          },
        };
      }
      return null;
    }

    const field = consume().value;
    const opToken = peek();
    if (opToken.type === "OPERATOR") {
      consume();
      const value = parseValue();
      return {
        type: "condition",
        condition: {
          field: resolveField(field),
          operator: OPERATOR_MAP[opToken.value] || "equals",
          value: value ?? null,
          operatorRaw: opToken.value,
        },
      };
    }
    return null;
  }

  function parseAnd(): JqlNode | null {
    let left = parseCondition();
    while (peek().type === "AND" || (peek().type === "FIELD" && peek().value.toUpperCase() === "AND")) {
      if (peek().type === "AND") consume();
      else if (peek().type === "FIELD") consume();
      const right = parseCondition();
      if (left && right) {
        left = { type: "group", operator: "AND", left, right };
      } else if (right) {
        left = right;
      }
    }
    return left;
  }

  function parseOr(): JqlNode | null {
    let left = parseAnd();
    while (peek().type === "OR" || (peek().type === "FIELD" && peek().value.toUpperCase() === "OR")) {
      if (peek().type === "OR") consume();
      else if (peek().type === "FIELD") consume();
      const right = parseAnd();
      if (left && right) {
        left = { type: "group", operator: "OR", left, right };
      } else if (right) {
        left = right;
      }
    }
    return left;
  }

  function parseOrderBy() {
    while (peek().type !== "EOF" && peek().type !== "ORDER_BY") {
      pos++;
    }
    if (peek().type === "ORDER_BY") {
      consume();
      while (peek().type !== "EOF" && peek().type !== "ORDER_BY") {
        const field = peek();
        if (field.type === "FIELD" || field.type === "VALUE") {
          consume();
          let dir: "ASC" | "DESC" = "ASC";
          if (peek().type === "ASC" || peek().type === "DESC") {
            dir = consume().value as "ASC" | "DESC";
          } else if (peek().type === "FIELD" && peek().value.toUpperCase() === "ASC") {
            consume();
            dir = "ASC";
          } else if (peek().type === "FIELD" && peek().value.toUpperCase() === "DESC") {
            consume();
            dir = "DESC";
          }
          orderBy.push({ field: resolveField(field.value), direction: dir });
          if (peek().type === "COMMA") consume();
        } else {
          break;
        }
      }
    }
  }

  const tree = parseOr();

  parseOrderBy();

  return { tree, orderBy, error: null };
}

function nodeToFilter(node: JqlNode | null | undefined, userId?: string): any {
  if (!node) return {};

  if (node.type === "condition" && node.condition) {
    const c = node.condition;
    let value = c.value;
    if (typeof value === "string" && value === "__currentUser__") {
      value = userId || value;
    }

    switch (c.operator) {
      case "equals": return { [c.field]: value };
      case "not_equals": return { [c.field]: { $ne: value } };
      case "greater_than": return { [c.field]: { $gt: value } };
      case "greater_than_or_equal": return { [c.field]: { $gte: value } };
      case "less_than": return { [c.field]: { $lt: value } };
      case "less_than_or_equal": return { [c.field]: { $lte: value } };
      case "contains":
        if (c.field === "title" || c.field === "description") {
          return { [c.field]: { $regex: String(value), $options: "i" } };
        }
        if (c.field === "labels") {
          return { labels: String(value) };
        }
        return { [c.field]: { $regex: String(value), $options: "i" } };
      case "not_contains":
        return { [c.field]: { $not: { $regex: String(value), $options: "i" } } };
      case "in":
        if (Array.isArray(value)) {
          return { [c.field]: { $in: value } };
        }
        if (typeof value === "string" && value.includes(",")) {
          return { [c.field]: { $in: value.split(",").map((v: string) => v.trim()) } };
        }
        return { [c.field]: { $in: [String(value)] } };
      case "not_in":
        if (Array.isArray(value)) {
          return { [c.field]: { $nin: value } };
        }
        return { [c.field]: { $nin: [String(value)] } };
      case "is":
        if (value === null || value === "NULL") return { [c.field]: null };
        if (value === "EMPTY") return { [c.field]: { $in: [null, ""] } };
        return { [c.field]: value };
      case "is_not":
        if (value === null || value === "NULL") return { [c.field]: { $ne: null } };
        if (value === "EMPTY") return { [c.field]: { $nin: [null, ""] } };
        return { [c.field]: { $ne: value } };
      default: return { [c.field]: value };
    }
  }

  if (node.type === "group") {
    const left = nodeToFilter(node.left, userId);
    const right = nodeToFilter(node.right, userId);
    if (node.operator === "AND") {
      return { $and: [left, right] };
    }
    if (node.operator === "OR") {
      return { $or: [left, right] };
    }
  }

  if (node.type === "not") {
    const inner = nodeToFilter(node.right, userId);
    return { $nor: [inner] };
  }

  return {};
}

export function parseJql(input: string, userId?: string): ParseResult {
  const { tokens, error: tokenError } = tokenize(input);
  if (tokenError) {
    return { tree: null, orderBy: [], error: tokenError };
  }
  const { tree, orderBy, error: parseError } = parseTokens(tokens, userId);
  if (parseError) {
    return { tree: null, orderBy: [], error: parseError };
  }
  return { tree, orderBy, error: null };
}

export function jqlToMongoFilter(input: string, userId?: string): { filter: any; orderBy: OrderByClause[]; error: { message: string; position: number } | null } {
  const { tree, orderBy, error } = parseJql(input, userId);
  if (error) {
    return { filter: {}, orderBy: [], error };
  }
  const filter = nodeToFilter(tree, userId);
  return { filter, orderBy, error: null };
}

export function validateJql(input: string): { valid: boolean; error: { message: string; position: number } | null } {
  const { tokens, error: tokenError } = tokenize(input);
  if (tokenError) {
    return { valid: false, error: tokenError };
  }
  const { error: parseError } = parseTokens(tokens);
  if (parseError) {
    return { valid: false, error: parseError };
  }
  return { valid: true, error: null };
}

export function getSuggestions(partial: string, type: "field" | "operator" | "value", workspaceId?: string) {
  const fields = [
    { value: "project", label: "Project" },
    { value: "type", label: "Issue Type" },
    { value: "issuetype", label: "Issue Type" },
    { value: "status", label: "Status" },
    { value: "assignee", label: "Assignee" },
    { value: "reporter", label: "Reporter" },
    { value: "priority", label: "Priority" },
    { value: "labels", label: "Labels" },
    { value: "component", label: "Component" },
    { value: "fixVersion", label: "Fix Version" },
    { value: "sprint", label: "Sprint" },
    { value: "created", label: "Created" },
    { value: "updated", label: "Updated" },
    { value: "due", label: "Due Date" },
    { value: "summary", label: "Summary" },
    { value: "description", label: "Description" },
    { value: "storyPoints", label: "Story Points" },
    { value: "parent", label: "Parent" },
  ];

  const operators = [
    { value: "=", label: "=" },
    { value: "!=", label: "!=" },
    { value: ">", label: ">" },
    { value: ">=", label: ">=" },
    { value: "<", label: "<" },
    { value: "<=", label: "<=" },
    { value: "IN", label: "IN" },
    { value: "NOT IN", label: "NOT IN" },
    { value: "~", label: "CONTAINS" },
    { value: "!~", label: "NOT CONTAINS" },
    { value: "IS", label: "IS" },
    { value: "IS NOT", label: "IS NOT" },
  ];

  if (type === "field") {
    const q = partial.toLowerCase();
    return fields.filter((f) => f.value.toLowerCase().includes(q) || f.label.toLowerCase().includes(q));
  }

  if (type === "operator") {
    return operators;
  }

  return [];
}

export { resolveField, resolveFunction, nodeToFilter, type OrderByClause };
