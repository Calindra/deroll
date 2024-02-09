import { Address } from "viem";
import { AdvanceRequestData, Payload } from "@deroll/app";

// TODO: Temporary type
export interface Account {
    address: Address;
    balance: bigint;
}

type Deposit = {
    detectPrefix(payload: AdvanceRequestData): void;
    decodeParameters(payload: Payload): void;
    writeAccount(address: Address): void;
};

type Withdraw = {
    withDrawAdvanceRequestData(payload: Payload): void;
    checkBalance(address: Address): void;
    emitVoucherAndSubtractBalance(address: Address, amount: bigint): void;
};

type InternalTransfer = {
    defineInteralTransferAdvanceRequestData(payload: Payload): void;
    checkFromBalance(address: Address): void;
    doTransfer(from: Address, to: Address, amount: bigint): void;
};

export type TransferBehavior = Deposit & Withdraw & InternalTransfer;
