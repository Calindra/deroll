import { Hex, getAddress } from "viem";
import { AdvanceRequestData, Payload } from "@deroll/app";
import { erc721PortalAddress, erc1155SinglePortalAddress } from "./rollups";

type Address = Hex;

export interface ERC721 {
    ownerOf(tokenId: bigint): string;
    balanceOf(address: Address): bigint;
    transferFrom(from: string, to: string, tokenId: bigint): void;
    safeTransferFrom(from: string, to: string, tokenId: bigint): void;
    approve(to: string, tokenId: bigint): void;
    setApprovalForAll(operator: string, approved: boolean): void;
    getApproved(tokenId: bigint): string;
    isApprovedForAll(owner: string, operator: string): boolean;
}

export interface ERC1155 {
    balanceOf(address: Address, tokenId: bigint): bigint;
    balanceOfBatch(address: Address, tokenIds: bigint[]): bigint[];
    setApprovalForAll(operator: string, approved: boolean): void;
    isApprovedForAll(owner: string, operator: string): boolean;
    safeTransferFrom(
        from: string,
        to: string,
        tokenId: bigint,
        amount: bigint,
        data: Payload,
    ): void;
    safeBatchTransferFrom(
        from: string,
        to: string,
        tokenIds: bigint[],
        amounts: bigint[],
        data: Payload,
    ): void;
}

interface Account {
    address: Address;
    balance: bigint;
}

const isERC721Deposit = (data: AdvanceRequestData): boolean =>
    getAddress(data.metadata.msg_sender) === erc721PortalAddress;

const isERC1155Deposit = (data: AdvanceRequestData): boolean =>
    getAddress(data.metadata.msg_sender) === erc1155SinglePortalAddress;

export class Deposit {
    constructor(private accounts: Map<string, Account>) {}
    detectPrefix(payload: Payload) {}
    decodeParameters(payload: Payload) {}
    writeAccount(address: Address) {
        if (!this.accounts.has(address)) {
            this.accounts.set(address, { address, balance: 0n });
        }
        throw new Error("Write method not implemented.");
    }
}

export class Withdraw {
    withDrawPayload(payload: Payload) {
        throw new Error("Method not implemented.");
    }
    checkBalance(address: Address) {}
    emitVoucherAndSubtractBalance(address: string, amount: bigint) {}
}

export class InternalTransfer {
    defineInteralTransferPayload(payload: Payload) {}
    checkFromBalance(address: Address) {}
    doTransfer(from: string, to: string, amount: bigint) {}
}

// export class WalletNFT implements ERC721 {
//     ownerOf(tokenId: bigint): string {
//         throw new Error("Method not implemented.");
//     }
//     balanceOf(address: Address): bigint {
//         throw new Error("Method not implemented.");
//     }
//     transferFrom(from: string, to: string, tokenId: bigint): void {
//         throw new Error("Method not implemented.");
//     }
//     safeTransferFrom(from: string, to: string, tokenId: bigint): void {
//         throw new Error("Method not implemented.");
//     }
//     approve(to: string, tokenId: bigint): void {
//         throw new Error("Method not implemented.");
//     }
//     setApprovalForAll(operator: string, approved: boolean): void {
//         throw new Error("Method not implemented.");
//     }
//     getApproved(tokenId: bigint): string {
//         throw new Error("Method not implemented.");
//     }
//     isApprovedForAll(owner: string, operator: string): boolean {
//         throw new Error("Method not implemented.");
//     }
// }
