import { MissingContextArgumentError } from "../errors";
import {
    type Address,
    isHex
} from "viem";
import { erc1155SinglePortalAddress } from "../rollups";
import { parseERC1155SingleDeposit } from "..";
import { TokenOperation, TokenContext } from "../token";

export class ERC1155Single implements TokenOperation {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    balanceOf<T extends bigint | bigint[]>(context: TokenContext): T {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    transfer(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    withdraw(context: TokenContext): { destination: Address; payload: string; } {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async deposit({
        payload, setWallet, getWallet,
    }: TokenContext): Promise<void> {
        console.log("ERC-1155 single");

        if (!payload || !isHex(payload) || !getWallet || !setWallet) {
            throw new MissingContextArgumentError<TokenContext>({
                payload,
                getWallet,
                setWallet,
            });
        }

        const { tokenId, sender, token, value } = parseERC1155SingleDeposit(payload);

        const wallet = getWallet(sender);
        let collection = wallet.erc1155.get(token);
        if (!collection) {
            collection = new Map();
            wallet.erc1155.set(token, collection);
        }
        const tokenBalance = collection.get(tokenId) ?? 0n;
        collection.set(tokenId, tokenBalance + value);
        setWallet(sender, wallet);
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc1155SinglePortalAddress;
    }
}
