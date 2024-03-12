import { inspect } from "node:util";
import type { TokenOperation } from "./token";

export class InvalidPayloadError extends Error {
    constructor(public payload: unknown) {
        super(`Invalid payload: ${inspect(payload)}`);
    }
}

export class MissingContextArgumentError<T extends object> extends Error {
    constructor(obj: T) {
        const missingKeys = Object.keys(obj).filter(
            (key) => obj[key as keyof T] === undefined,
        );
        super(`Missing context argument: ${missingKeys.join(", ")}`);
    }
}
export class NotApplicableError<
    T extends string = keyof TokenOperation,
> extends Error {
    constructor(public operation: T) {
        super(`Operation not applicable: ${operation}`);
    }
}
