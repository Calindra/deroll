import { inspect } from "node:util";
import type { TokenContext } from "./token";

export class InvalidPayloadError extends Error {
    constructor(public payload: unknown) {
        super(`Invalid payload: ${inspect(payload)}`);
    }
}

export class MissingContextArgumentError<
    T extends string = keyof TokenContext,
> extends Error {
    constructor(public args: T[]) {
        super(`Missing context argument: ${args.join(", ")}`);
    }
}

export class NotApplicableError extends Error {
    constructor(public operation: string) {
        super(`Operation not applicable: ${operation}`);
    }
}
