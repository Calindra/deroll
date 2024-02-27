import { isERC1155SingleDeposit, parseERC1155SingleDeposit } from ".";
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
    isDeposit(data: unknown): boolean;

    /**
     * Does not reject
     * @param data
     */
    handle(data: unknown, wallets: WalletAppImpl): void;
}

export class ERC1155Single implements ERCHandler {
    isDeposit(data: unknown): boolean {
        if (!isValidAdvanceRequestData(data)) {
            return false;
        }
        return isERC1155SingleDeposit(data);
    }

    handle(data: unknown, wallets: WalletAppImpl): void {
        console.log("ERC-1155 single");
        if (!isValidAdvanceRequestData(data)) {
            throw new Error("Invalid data");
        }
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
