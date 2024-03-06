import { isValidAdvanceRequestData } from "./util";
import {
    InvalidPayloadError,
    MissingContextArgumentError,
    NotApplicableError,
} from "./errors";
import { getAddress, type Address, isHex } from "viem";
import {
    dAppAddressRelayAddress,
    erc1155BatchPortalAddress,
    erc1155SinglePortalAddress,
    erc20PortalAddress,
    erc721PortalAddress,
    etherPortalAddress,
} from "./rollups";
import type { Voucher } from "@deroll/app";
import { parseEtherDeposit } from ".";
import type { Wallet } from "./wallet";

export type TokenContext = Partial<{
    address: string;
    addresses: string[];
    tokenIds: bigint[];
    tokenId: bigint;
    token: bigint;
    owner: string;
    amount: bigint;
    tokenOrAddress: string;
    recipient: Address;
    payload: string;
    setDapp(address: Address): void;
    getWallet(address: Address): Wallet;
    setWallet(address: Address, wallet: Wallet): void;
}>;

export interface TokenOperation {
    isDeposit(msgSender: Address): boolean;

    deposit(context: TokenContext): Promise<void>;

    balanceOf<T extends bigint | bigint[]>(context: TokenContext): T;
    transfer(context: TokenContext): void;
    withdraw(context: TokenContext): Voucher;
}

class Ether implements TokenOperation {
    balanceOf<T extends bigint | bigint[]>(context: TokenContext): T {
        throw new Error("Method not implemented.");
    }
    transfer(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    withdraw(context: TokenContext): { destination: Address; payload: string } {
        throw new Error("Method not implemented.");
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === etherPortalAddress;
    }
    async deposit(context: TokenContext): Promise<void> {
        if (!context.payload || !isHex(context.payload))
            throw new MissingContextArgumentError(["payload"]);

        if (!context.getWallet || !context.setWallet) {
            throw new MissingContextArgumentError(["getWallet", "setWallet"]);
        }

        console.log("etherPortalAddress");
        const { sender, value } = parseEtherDeposit(context.payload);
        const wallet = context.getWallet(sender);
        wallet.ether += value;
        context.setWallet(sender, wallet);
    }
}

class ERC20 implements TokenOperation {
    balanceOf<T = bigint>({
        address,
        getWallet,
        tokenOrAddress,
    }: TokenContext): T {
        if (!address || !getWallet || !tokenOrAddress)
            throw new MissingContextArgumentError(["address", "getWallet"]);
        const addr = getAddress(address);

        const erc20address = getAddress(tokenOrAddress);
        const wallet = getWallet(addr);
        const result = wallet.erc20.get(erc20address) ?? 0n;
        return result as T;
    }
    transfer(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    withdraw(context: TokenContext): { destination: Address; payload: string } {
        throw new Error("Method not implemented.");
    }
    deposit(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc20PortalAddress;
    }
}
class ERC721 implements TokenOperation {
    balanceOf<T extends bigint | bigint[]>(context: TokenContext): T {
        throw new Error("Method not implemented.");
    }
    transfer(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    withdraw(context: TokenContext): { destination: Address; payload: string } {
        throw new Error("Method not implemented.");
    }
    deposit(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc721PortalAddress;
    }
}
class ERC1155Batch implements TokenOperation {
    balanceOf<T extends bigint | bigint[]>(context: TokenContext): T {
        throw new Error("Method not implemented.");
    }
    transfer(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    withdraw(context: TokenContext): { destination: Address; payload: string } {
        throw new Error("Method not implemented.");
    }
    deposit(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc1155BatchPortalAddress;
    }
}

class ERC1155Single implements TokenOperation {
    balanceOf<T extends bigint | bigint[]>(context: TokenContext): T {
        throw new Error("Method not implemented.");
    }
    transfer(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    withdraw(context: TokenContext): { destination: Address; payload: string } {
        throw new Error("Method not implemented.");
    }
    deposit(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc1155SinglePortalAddress;
    }
}

class Relay implements TokenOperation {
    isDeposit(msgSender: Address): boolean {
        return msgSender === dAppAddressRelayAddress;
    }
    async deposit({ payload, setDapp }: TokenContext): Promise<void> {
        if (!payload || !setDapp)
            throw new MissingContextArgumentError(["setDapp", "payload"]);
        console.log("dAppAddressRelayAddress");
        const dapp = getAddress(payload);
        setDapp(dapp);
    }
    balanceOf<T extends bigint | bigint[]>(): T {
        throw new NotApplicableError(this.balanceOf.name);
    }
    transfer(): Promise<void> {
        throw new NotApplicableError(this.transfer.name);
    }
    withdraw(): { destination: Address; payload: string } {
        throw new NotApplicableError(this.withdraw.name);
    }
}

export class TokenHandler {
    private static instance: TokenHandler;
    private readonly handlers: TokenOperation[];

    /**
     * Singleton
     */
    private constructor() {
        this.handlers = [
            new Ether(),
            new ERC20(),
            new ERC721(),
            new ERC1155Batch(),
            new ERC1155Single(),
            new Relay(),
        ];
    }
    public static getInstance(): TokenHandler {
        if (!TokenHandler.instance) {
            TokenHandler.instance = new TokenHandler();
        }
        return TokenHandler.instance;
    }

    /**
     * Find the deposit handler for the given data
     * @param data payload with metadata
     * @returns
     * @throws if data is invalid
     */
    public findDepositHandler(data: unknown): TokenOperation | undefined {
        if (!isValidAdvanceRequestData(data)) {
            throw new InvalidPayloadError(data);
        }
        const msgSender = getAddress(data.metadata.msg_sender);

        const handler = this.handlers.find((handler) =>
            handler.isDeposit(msgSender),
        );
        if (handler) {
            return handler;
        }
    }
}
