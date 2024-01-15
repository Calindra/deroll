# deroll

Deroll is a TypeScript framework for developing [Cartesi](https://cartesi.io) applications.
The code below is a minimal application which just loops forever fetching inputs, but with no input handlers.
In that case any input is `rejected`.

Input handles are functions that take an input and return a promise of an output.

## Requeriments

- Corepack (with pnpm) or pnpm v8 (8.7.1 recommended)
- Node 20 or greater (LTS)

## Installation

Corepack is a package manager that allows you to install packages from different package managers.
It is recommended to use it to install deroll because it come with nodejs.
But you can use pnpm if you want. To install corepack follow the instructions [here](https://pnpm.io/installation).

```sh
corepack install
corepack pnpm install
```

## Usage

This is a example

## Example

Simple exampel of a deroll app:

```typescript
import { createApp } from "@deroll/app";

const app = createApp({ url: "http://127.0.0.1:5004" });
// TODO: add input handlers here
app.start().catch((e) => process.exit(1));
```

## License

This code is licensed under the [MIT License](./LICENSE).
