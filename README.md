# `formdata-parser`

Parse `FormData` / `URLSearchParams` into a typed JavaScript object using inline field prefixes like:

- `number::age=22`
- `array::tags=a,b,c`
- `boolean::pro=true`
- `json::meta={"a":1}`

✅ Works in **Node**, **Bun**, **Deno**, **Browsers**, **Edge**
✅ Type casting + nested keys + multi-values  
✅ Zero dependencies

---

## Installation

```bash
npm install @shpaw415/formdata-parser
```

or

```bash
bun add @shpaw415/formdata-parser
```

---

## Quick Example (HTML)

This works directly in the browser:

```html
<form id="my-form">
  <input name="string::name" value="John" />
  <input name="number::age" value="22" />
  <input name="boolean::pro" value="true" />
  <input name="array::tags" value="js, ts, bun" />
  <input name="json::meta" value='{"role":"admin"}' />
  <button type="submit">Submit</button>
</form>

<script type="module">
  import { parseTypedFormData } from "typed-formdata";

  const form = document.querySelector("#my-form");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const obj = parseTypedFormData(fd);

    console.log(obj);
  });
</script>
```

Output:

```json
{
  "name": "John",
  "age": 22,
  "pro": true,
  "tags": ["js", "ts", "bun"],
  "meta": { "role": "admin" }
}
```

---

## Why?

`FormData` always returns strings.

So instead of manually writing this everywhere:

```ts
const age = Number(fd.get("age"));
const tags = String(fd.get("tags")).split(",");
```

You can just send:

```
number::age=22
array::tags=a,b,c
```

And the parser automatically returns:

```json
{ "age": 22, "tags": ["a", "b", "c"] }
```

---

## Supported Types

| Prefix      | Example input              | Output          |
| ----------- | -------------------------- | --------------- |
| `string::`  | `string::name=Justin`      | `"Justin"`      |
| `number::`  | `number::age=22`           | `22`            |
| `boolean::` | `boolean::pro=true`        | `true`          |
| `array::`   | `array::tags=a,b,c`        | `["a","b","c"]` |
| `json::`    | `json::meta={"a":1}`       | `{ a: 1 }`      |
| `date::`    | `date::startAt=2026-01-01` | `Date`          |

---

## Array separators

By default, `array::` uses a comma.

```ts
fd.set("array::tags", "a,b,c");
```

Output:

```js
{
  tags: ["a", "b", "c"];
}
```

### Custom separator

Use:

```
array(|)::tags=a|b|c
```

Example:

```ts
fd.set("array(|)::tags", "admin|dev|owner");
```

Output:

```js
{
  tags: ["admin", "dev", "owner"];
}
```

---

## Multi-value fields (append)

If your form sends the same field multiple times:

```ts
fd.append("array::tags", "a,b");
fd.append("array::tags", "c,d");
```

Output:

```js
{
  tags: ["a", "b", "c", "d"];
}
```

---

## List key/value pairs

Build dynamic dictionaries by pairing `list::key` and `list::value` inputs that share the same name and index:

```ts
fd.set("list::key::env::0", "API_URL");
fd.set("list::value::env::0", "https://example.com");
fd.set("list::key::env::1", "API_TOKEN");
fd.set("list::value::env::1", "secret");
```

Output:

```js
{
  env: {
    API_URL: "https://example.com",
    API_TOKEN: "secret"
  }
}
```

Keys with empty values are skipped automatically.

---

## Nested keys

Dots create nested objects:

```ts
fd.set("user.name", "John");
fd.set("number::user.age", "30");
```

Output:

```js
{
  user: {
    name: "John",
    age: 30
  }
}
```

---

## Files support

If a `FormData` entry is a `File`, it is kept as-is:

```ts
fd.set("file::avatar", myFile);
```

Output:

```js
{
  avatar: File(...)
}
```

> Note: `file::` is optional. Any `File` will be returned as a `File`.

---

## API

### `parseTypedFormData(input, options?)`

#### Input

Supports:

- `FormData`
- `URLSearchParams`
- plain objects (`Record<string, any>`)

#### Options

```ts
type ParseOptions = {
  ignoreEmpty?: boolean;
  strict?: boolean;
  defaultArraySeparator?: string;
};
```

##### `ignoreEmpty`

If enabled, empty strings are ignored:

```ts
parseTypedFormData(fd, { ignoreEmpty: true });
```

##### `strict`

If enabled, invalid casts throw:

- invalid number
- invalid JSON
- invalid date
- invalid boolean

```ts
parseTypedFormData(fd, { strict: true });
```

##### `defaultArraySeparator`

Change the default separator for `array::`:

```ts
parseTypedFormData(fd, { defaultArraySeparator: ";" });
```

---

## Boolean parsing rules

Accepted values:

### true

- `true`
- `1`
- `yes`
- `on`

### false

- `false`
- `0`
- `no`
- `off`

---

## TypeScript

This package is written in TypeScript and ships with types.

---

## License

MIT
