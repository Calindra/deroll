import { Address } from "viem";
import { AdvanceRequestData, Payload } from "@deroll/app";

interface Account {
    address: Address;
    balance: bigint;
}

export class Deposit {
    constructor(private accounts: Map<string, Account>) {}
    detectPrefix(payload: AdvanceRequestData) {}
    decodeParameters(payload: Payload) {}
    writeAccount(address: Address) {
        if (!this.accounts.has(address)) {
            this.accounts.set(address, { address, balance: 0n });
        }
        throw new Error("Write method not implemented.");
    }
}

export class Withdraw {
    withDrawAdvanceRequestData(payload: Payload) {
        throw new Error("Method not implemented.");
    }
    checkBalance(address: Address) {}
    emitVoucherAndSubtractBalance(address: string, amount: bigint) {}
}

export class InternalTransfer {
    defineInteralTransferAdvanceRequestData(payload: Payload) {}
    checkFromBalance(address: Address) {}
    doTransfer(from: string, to: string, amount: bigint) {}
}
