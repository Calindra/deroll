import {
    isERC1155BatchDeposit,
    isERC1155SingleDeposit,
    isERC20Deposit,
    isERC721Deposit,
    parseERC1155SingleDeposit,
} from ".";
import { inspect } from "node:util";
import { WalletAppImpl } from "./wallet";
import { AdvanceRequestData, RequestMetadata } from "@deroll/app";
import { isAddress, isHex } from "viem";

// Utils
const isNum = (x: unknown): x is number =>
    typeof x === "number" && !Number.isNaN(x);
const haveKeys = <T extends object>(
    obj: unknown,
    keys: (keyof T)[],
): obj is T =>
    typeof obj === "object" && obj !== null && keys.every((key) => key in obj);

const checkMetadata = (metadata: unknown): metadata is RequestMetadata => {
    return (
        haveKeys(metadata, [
            "msg_sender",
            "epoch_index",
            "input_index",
            "block_number",
            "timestamp",
        ]) &&
        isAddress(metadata.msg_sender) &&
        isNum(metadata.epoch_index) &&
        isNum(metadata.input_index) &&
        isNum(metadata.block_number) &&
        isNum(metadata.timestamp)
    );
};

const isValidAdvanceRequestData = (
    data: unknown,
): data is AdvanceRequestData => {
    return (
        haveKeys(data, ["payload", "metadata"]) &&
        checkMetadata(data.metadata) &&
        isHex(data.payload)
    );
};

export interface ERCHandler {
    isDeposit(data: AdvanceRequestData): boolean;

    /**
     * Does not reject
     * @param data
     */
    handle(data: AdvanceRequestData, wallets: WalletAppImpl): void;
}

export class ERC20 implements ERCHandler {
    isDeposit(data: AdvanceRequestData): boolean {
        return isERC20Deposit(data);
    }
    handle(data: AdvanceRequestData, wallets: WalletAppImpl): void {
        throw new Error("Method not implemented.");
    }
}
export class ERC721 implements ERCHandler {
    isDeposit(data: AdvanceRequestData): boolean {
        return isERC721Deposit(data);
    }
    handle(data: AdvanceRequestData, wallets: WalletAppImpl): void {
        throw new Error("Method not implemented.");
    }
}
export class ERC1155Batch implements ERCHandler {
    isDeposit(data: AdvanceRequestData): boolean {
        return isERC1155BatchDeposit(data);
    }
    handle(data: AdvanceRequestData, wallets: WalletAppImpl): void {
        throw new Error("Method not implemented.");
    }
}

export class ERC1155Single implements ERCHandler {
    isDeposit(data: AdvanceRequestData): boolean {
        return isERC1155SingleDeposit(data);
    }

    handle(data: AdvanceRequestData, wallets: WalletAppImpl): void {
        console.log("ERC-1155 single");
        const { tokenId, sender, token, value } = parseERC1155SingleDeposit(
            data.payload,
        );

        const wallet = wallets.getWalletOrNew(sender);
        let collection = wallet.erc1155.get(token);
        if (!collection) {
            collection = new Map();
            wallet.erc1155.set(token, collection);
        }
        const tokenBalance = collection.get(tokenId) ?? 0n;
        collection.set(tokenId, tokenBalance + value);
        console.log("Wallet", inspect(wallet));
    }
}

export class ERCX {
    private static instance: ERCX;
    private readonly handlers: ERCHandler[] = [
        new ERC20(),
        new ERC721(),
        new ERC1155Batch(),
        new ERC1155Single(),
    ];

    private constructor() {}
    private getInstance(): ERCX {
        if (!ERCX.instance) {
            ERCX.instance = new ERCX();
        }
        return ERCX.instance;
    }

    /**
     * Find the deposit handler for the given data
     * @param data payload with metadata
     * @returns
     * @throws if data is invalid
     */
    findDeposit(data: unknown): ERCHandler | undefined {
        if (!isValidAdvanceRequestData(data)) {
            throw new Error("Invalid data");
        }

        return this.handlers.find((handler) => handler.isDeposit(data));
    }
}
