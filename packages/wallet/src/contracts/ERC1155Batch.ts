import {
    type Address,
    isHex,
    getAddress,
    isAddress,
    encodeFunctionData,
} from "viem";
import { Voucher } from "@deroll/app";
import { erc1155Abi, erc1155BatchPortalAddress } from "../rollups";
import { parseERC1155BatchDeposit } from "..";
import { DepositArgs, DepositOperation } from "../token";
import { Wallet } from "../wallet";

interface BalanceOf {
    addresses: string[];
    tokenIds: bigint[];
    owner: string;
    getWallet(address: string): Wallet;
}

interface Transfer {
    tokenIds: bigint[];
    amounts: bigint[];
    from: Address;
    to: Address;
    getWallet(address: Address): Wallet;
    setWallet(address: Address, wallet: Wallet): void;
    token: Address;
}

interface Withdraw {
    tokenIds: bigint[];
    amounts: bigint[];
    token: Address;
    address: Address;
    getWallet(address: Address): Wallet;
    getDapp(): Address;
}

export class ERC1155Batch implements DepositOperation {
    balanceOf({ addresses, tokenIds, owner, getWallet }: BalanceOf): bigint[] {
        if (addresses.length !== tokenIds.length) {
            throw new Error("addresses and tokenIds must have the same length");
        }

        const ownerAddress = getAddress(owner);
        const wallet = getWallet(ownerAddress);
        const balances: bigint[] = [];

        for (let i = 0; i < addresses.length; i++) {
            let address = addresses[i];
            if (isAddress(address)) {
                address = getAddress(address);
            }

            const tokenId = tokenIds[i];

            const collection = wallet.erc1155[address as Address];
            const item = collection?.get(tokenId) ?? 0n;
            balances.push(item);
        }

        return balances;
    }
    transfer({
        tokenIds,
        amounts,
        from,
        to,
        getWallet,
        setWallet,
        token,
    }: Transfer): void {
        if (tokenIds.length !== amounts.length) {
            throw new Error("tokenIds and values must have the same length");
        }

        if (isAddress(from)) {
            from = getAddress(from);
        }

        if (isAddress(to)) {
            to = getAddress(to);
        }

        const walletFrom = getWallet(from);
        const walletTo = getWallet(to);

        let nfts = walletFrom.erc1155[token];
        if (!nfts) {
            nfts = new Map();
            walletFrom.erc1155[token] = nfts;
        }

        // check balance
        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const amount = amounts[i];

            const item = nfts.get(tokenId) ?? 0n;

            if (amount < 0n) {
                throw new Error(
                    `negative value for tokenId ${tokenId}: ${amount}`,
                );
            }
            if (item < amount) {
                throw new Error(
                    `insufficient balance of user ${from} of token ${tokenId}: ${amount.toString()} > ${
                        item.toString() ?? "0"
                    }`,
                );
            }
        }

        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const amount = amounts[i];
            const item = nfts.get(tokenId) ?? 0n;
            nfts.set(tokenId, item - amount);
        }

        let nftsTo = walletTo.erc1155[token];
        if (!nftsTo) {
            nftsTo = new Map();
            walletTo.erc1155[token] = nftsTo;
        }

        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const value = amounts[i];
            const item = nftsTo.get(tokenId) ?? 0n;
            nftsTo.set(tokenId, item + value);
        }

        setWallet(from as Address, walletFrom);
        setWallet(to as Address, walletTo);
    }
    withdraw({
        getWallet,
        tokenIds,
        amounts,
        token,
        address,
        getDapp,
    }: Withdraw): Voucher {
        if (!tokenIds.length || !amounts.length) {
            throw new Error("tokenIds and values must not be empty");
        }

        if (tokenIds.length !== amounts.length) {
            throw new Error(
                `tokenIds(size: ${tokenIds.length})) and values(size: ${amounts.length}) must have the same length`,
            );
        }

        // normalize addresses
        token = getAddress(token);
        address = getAddress(address);

        const wallet = getWallet(address);
        let nfts = wallet.erc1155[token];

        if (!nfts) {
            nfts = new Map();
            wallet.erc1155[token] = nfts;
        }

        // check balance
        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const value = amounts[i];
            if (value < 0n) {
                throw new Error(
                    `negative value for tokenId ${tokenId}: ${value}`,
                );
            }
            const balance = nfts.get(tokenId) ?? 0n;
            if (balance < value) {
                throw new Error(
                    `insufficient balance of user ${address} of token ${token} of tokenId ${tokenId}: ${value.toString()} > ${
                        balance.toString() ?? "0"
                    }`,
                );
            }
        }

        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const value = amounts[i];
            const balance = nfts.get(tokenId) ?? 0n;
            nfts.set(tokenId, balance - value);
        }

        const dappAddress = getDapp();
        let call = encodeFunctionData({
            abi: erc1155Abi,
            functionName: "safeBatchTransferFrom",
            args: [dappAddress, address as Address, tokenIds, amounts, "0x"],
        });

        if (tokenIds.length === 1 && amounts.length === 1) {
            call = encodeFunctionData({
                abi: erc1155Abi,
                functionName: "safeTransferFrom",
                args: [
                    dappAddress,
                    address as Address,
                    tokenIds[0],
                    amounts[0],
                    "0x",
                ],
            });
        }

        return {
            destination: token,
            payload: call,
        };
    }
    async deposit({
        payload,
        setWallet,
        getWallet,
    }: DepositArgs): Promise<void> {
        const { token, sender, tokenIds, values } =
            parseERC1155BatchDeposit(payload);

        const wallet = getWallet(sender);
        let collection = wallet.erc1155[token];
        if (!collection) {
            collection = new Map();
            wallet.erc1155[token] = collection;
        }

        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const value = values[i];

            const tokenBalance = collection.get(tokenId) ?? 0n;
            collection.set(tokenId, tokenBalance + value);
        }
        setWallet(sender, wallet);
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc1155BatchPortalAddress;
    }
}
export const erc1155Batch = new ERC1155Batch();
