import {
    type Address,
    getAddress,
    isAddress,
    encodeFunctionData,
} from "viem";
import type { AdvanceRequestHandler, Voucher } from "@deroll/app";
import { erc1155Abi } from "../rollups";
import { parseERC1155SingleDeposit } from "..";
import {  CanHandler } from "../types";
import type { Wallet } from "../wallet";
import { InsufficientBalanceError } from "../errors";

interface BalanceOf {
    address: Address;
    tokenId: bigint;
    owner: string;
    getWallet(address: string): Wallet;
}

interface Transfer {
    from: string;
    to: string;
    getWallet(address: string): Wallet;
    setWallet(address: string, wallet: Wallet): void;
    token: Address;
    tokenId: bigint;
    amount: bigint;
}

interface Withdraw {
    token: Address;
    address: Address;
    getWallet(address: string): Wallet;
    getDapp(): Address;
    tokenId: bigint;
    amount: bigint;
}

export class ERC1155Single implements CanHandler {
    balanceOf({ address, tokenId, getWallet, owner }: BalanceOf): bigint {
        const wallet = getWallet(owner);
        address = getAddress(address);

        const collection = wallet.erc1155[address];
        const balance = collection?.get(tokenId) ?? 0n;

        return balance;
    }
    transfer({
        from,
        to,
        getWallet,
        token,
        tokenId,
        amount,
        setWallet,
    }: Transfer): void {
        token = getAddress(token);

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
        const balance = nfts.get(tokenId) ?? 0n;

        if (balance < amount) {
            throw new InsufficientBalanceError(from, token, tokenId);
        }

        nfts.set(tokenId, balance - amount);

        let nftsTo = walletTo.erc1155[token];
        if (!nftsTo) {
            nftsTo = new Map();
            walletTo.erc1155[token] = nftsTo;
        }

        const item = nftsTo.get(tokenId) ?? 0n;
        nftsTo.set(tokenId, item + amount);

        setWallet(from, walletFrom);
        setWallet(to, walletTo);
    }
    withdraw({
        getWallet,
        tokenId,
        amount,
        token,
        address,
        getDapp,
    }: Withdraw): Voucher {
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
        const balance = nfts.get(tokenId) ?? 0n;
        if (balance < amount) {
            throw new InsufficientBalanceError(address, token, tokenId);
        }

        nfts.set(tokenId, balance - amount);

        const dappAddress = getDapp();

        const call = encodeFunctionData({
            abi: erc1155Abi,
            functionName: "safeTransferFrom",
            args: [dappAddress, address, tokenId, amount, "0x"],
        });

        return {
            destination: token,
            payload: call,
        };
    }

    handler: AdvanceRequestHandler = async (data) => {
        return "accept"
    }


    async deposit({
        payload,
        setWallet,
        getWallet,
    }: any): Promise<void> {
        const { tokenId, sender, token, value } =
            parseERC1155SingleDeposit(payload);

        const wallet = getWallet(sender);
        let collection = wallet.erc1155[token];
        if (!collection) {
            collection = new Map();
            wallet.erc1155[token] = collection;
        }
        const tokenBalance = collection.get(tokenId) ?? 0n;
        collection.set(tokenId, tokenBalance + value);
        setWallet(sender, wallet);
    }
}

export const erc1155Single = new ERC1155Single();
