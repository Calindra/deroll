import { inspect } from "node:util";

export class InvalidPayloadError extends Error {
    constructor(public payload: unknown) {
        super(`Invalid payload: ${inspect(payload)}`);
    }
}

/**
 * @todo withdraw and transfer when throw error specific
 */