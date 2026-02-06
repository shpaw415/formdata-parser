type Primitive = string | number | boolean | null | Date;
type ParsedValue = Primitive | Primitive[] | Record<string, any>;

type ParseOptions = {
  /**
   * Si true: ignore les champs vides ("")
   * - string vide => supprimé
   * - array vide => []
   */
  ignoreEmpty?: boolean;

  /**
   * Si true: si une conversion échoue (number/json/date)
   * -> throw Error
   * sinon -> garde la string originale
   */
  strict?: boolean;

  /**
   * Par défaut: "array" split par virgule
   */
  defaultArraySeparator?: string;
};

const DEFAULT_OPTIONS: Required<ParseOptions> = {
  ignoreEmpty: false,
  strict: false,
  defaultArraySeparator: ",",
};

type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "json"
  | "date"
  | "list";

type ParsedFieldName = {
  type: FieldType;
  key: string;
  arraySeparator?: string;
};

type ListEntry = {
  variant: "key" | "value";
  name: string;
  index: string;
  value: string;
};

function parseFieldName(raw: string): ParsedFieldName {
  // formats:
  // array::tags
  // array(|)::tags
  // number::age
  // user.name (si pas de type, => string)

  const typeSplit = raw.split("::");
  if (typeSplit.length === 1) {
    return { type: "string", key: raw };
  }

  const left = typeSplit[0]!;
  const key = typeSplit.slice(1).join("::"); // au cas où

  // array(|)
  const m = left.match(/^([a-z]+)(\((.*)\))?$/i);
  if (!m) return { type: "string", key: raw };

  const type = (m[1] || "string").toLowerCase() as FieldType;
  const opt = m[3]; // contenu entre (...)

  if (type === "array") {
    return {
      type,
      key,
      arraySeparator: opt ?? undefined,
    };
  }

  return { type, key };
}

function isEmptyValue(v: any) {
  return v === "" || v === null || v === undefined;
}

function splitArrayValue(value: string, sep: string) {
  if (value.trim() === "") return [];
  return value
    .split(sep)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function parseBoolean(value: string): boolean | null {
  const v = value.trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(v)) return true;
  if (["false", "0", "no", "off"].includes(v)) return false;

  return null;
}

function isPlainObject(value: any): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function parseListEntry(
  rawName: string,
  rawValue: any,
  opts: Required<ParseOptions>,
): ListEntry | null {
  const parts = rawName.split("::");
  if (parts.length < 4) {
    if (opts.strict) throw new Error(`Invalid list field: "${rawName}"`);
    return null;
  }

  const variant = (parts[1] || "").toLowerCase();
  if (variant !== "key" && variant !== "value") {
    if (opts.strict) throw new Error(`Invalid list field: "${rawName}"`);
    return null;
  }

  const index = parts[parts.length - 1] ?? "";
  const name = parts.slice(2, -1).join("::");

  if (!name || !index) {
    if (opts.strict) throw new Error(`Invalid list field: "${rawName}"`);
    return null;
  }

  return {
    variant,
    name,
    index,
    value: String(rawValue ?? ""),
  };
}

function applyListEntries(entries: ListEntry[], target: Record<string, any>) {
  if (entries.length === 0) return;

  const keys = entries.filter((entry) => entry.variant === "key");
  const values = entries.filter((entry) => entry.variant === "value");
  const valueMap = new Map<string, string>();

  for (const valueEntry of values) {
    valueMap.set(`${valueEntry.name}::${valueEntry.index}`, valueEntry.value);
  }

  for (const keyEntry of keys) {
    if (keyEntry.value.trim() === "") continue;

    const matchedValue =
      valueMap.get(`${keyEntry.name}::${keyEntry.index}`) ?? "";

    let container = getDeep(target, keyEntry.name);
    if (!isPlainObject(container)) {
      setDeep(target, keyEntry.name, {});
      container = getDeep(target, keyEntry.name);
    }

    if (isPlainObject(container)) {
      container[keyEntry.value] = matchedValue;
    }
  }
}

function setDeep(obj: any, path: string, value: any) {
  // support:
  // user.name
  // user.profile.age
  // tags (simple)

  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;

  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }

  cur[parts[parts.length - 1]!] = value;
}

function getDeep(obj: any, path: string) {
  const parts = path.split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function castValue(
  type: FieldType,
  raw: string,
  opts: Required<ParseOptions>,
  arraySeparator?: string,
): ParsedValue {
  const value = raw ?? "";

  if (type === "string") return value;

  if (type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      if (opts.strict) throw new Error(`Invalid number: "${value}"`);
      return value;
    }
    return n;
  }

  if (type === "boolean") {
    const b = parseBoolean(value);
    if (b === null) {
      if (opts.strict) throw new Error(`Invalid boolean: "${value}"`);
      return value;
    }
    return b;
  }

  if (type === "date") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      if (opts.strict) throw new Error(`Invalid date: "${value}"`);
      return value;
    }
    return d;
  }

  if (type === "json") {
    try {
      return JSON.parse(value);
    } catch {
      if (opts.strict) throw new Error(`Invalid JSON: "${value}"`);
      return value;
    }
  }

  if (type === "array") {
    const sep = arraySeparator ?? opts.defaultArraySeparator;
    return splitArrayValue(value, sep);
  }

  return value;
}

export function parseTypedFormData(
  input: FormData | URLSearchParams | Record<string, any>,
  options: ParseOptions = {},
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const out: Record<string, any> = {};
  const listEntries: ListEntry[] = [];

  // helper: iter
  const entries: Array<[string, any]> = [];

  if (input instanceof FormData) {
    for (const [k, v] of input.entries()) entries.push([k, v]);
  } else if (input instanceof URLSearchParams) {
    for (const [k, v] of input.entries()) entries.push([k, v]);
  } else {
    for (const k of Object.keys(input)) entries.push([k, input[k]]);
  }

  for (const [rawName, rawVal] of entries) {
    const { type, key, arraySeparator } = parseFieldName(rawName);

    if (type === "list") {
      const parsed = parseListEntry(rawName, rawVal, opts);
      if (parsed) listEntries.push(parsed);
      continue;
    }

    // Support File dans FormData
    if (rawVal instanceof File) {
      // Si tu veux gérer "file::avatar" etc, tu peux.
      // Ici: on garde le File tel quel.
      setDeep(out, key, rawVal);
      continue;
    }

    const rawString = String(rawVal ?? "");

    if (opts.ignoreEmpty && rawString.trim() === "") {
      // ignore
      continue;
    }

    const parsed = castValue(type, rawString, opts, arraySeparator);

    // 🔥 Multi-values:
    // si on reçoit plusieurs fois array::tags, on merge
    if (type === "array") {
      const existing = getDeep(out, key);

      if (Array.isArray(existing)) {
        // existing est un array (déjà set)
        setDeep(out, key, [...existing, ...(parsed as any[])]);
      } else if (existing !== undefined) {
        // existait mais pas un array -> on le transforme en array
        setDeep(out, key, [existing, ...(parsed as any[])]);
      } else {
        setDeep(out, key, parsed);
      }
      continue;
    }

    // si le même champ revient plusieurs fois:
    // - si déjà présent -> devient array
    const existing = getDeep(out, key);
    if (existing === undefined) {
      setDeep(out, key, parsed);
    } else if (Array.isArray(existing)) {
      setDeep(out, key, [...existing, parsed]);
    } else {
      setDeep(out, key, [existing, parsed]);
    }
  }

  applyListEntries(listEntries, out);

  // Option ignoreEmpty pour arrays vides
  if (opts.ignoreEmpty) {
    // petit cleanup: supprime "" dans arrays
    const clean = (obj: any) => {
      if (Array.isArray(obj)) {
        return obj.filter((x) => !isEmptyValue(x));
      }
      if (obj && typeof obj === "object") {
        for (const k of Object.keys(obj)) {
          obj[k] = clean(obj[k]);
        }
      }
      return obj;
    };
    return clean(out);
  }

  return out;
}

export default parseTypedFormData;
