import { AdvanceRequestHandler, Voucher } from "@deroll/app";
import { Address, encodeFunctionData, getAddress, isAddress } from "viem";

import { cartesiDAppAbi, erc20Abi, erc1155Abi, erc721Abi } from "./rollups";
import { inspect } from "node:util";
import { TokenHandler } from "./token";

export type Wallet = {
    ether: bigint;
    erc20: Map<Address, bigint>;
    erc721: Map<Address, Set<bigint>>;
    erc1155: Map<Address, Map<bigint, bigint>>;
};

export interface WalletApp {
    balanceOf(address: string): bigint;
    balanceOf(token: Address, address: string): bigint;
    balanceOfERC721(token: Address, owner: string): bigint;
    balanceOfERC1155(
        addresses: string | string[],
        tokenIds: bigint | bigint[],
        owner: string | Address,
    ): bigint | bigint[];
    handler: AdvanceRequestHandler;
    transferEther(from: string, to: string, amount: bigint): void;
    transferERC20(
        token: Address,
        from: string,
        to: string,
        amount: bigint,
    ): void;
    transferERC721(
        token: Address,
        from: string,
        to: string,
        tokenId: bigint,
    ): void;
    transferERC1155(
        token: Address,
        from: string,
        to: string,
        tokenIds: bigint[],
        values: bigint[],
    ): void;
    withdrawEther(address: Address, amount: bigint): Voucher;
    withdrawERC20(token: Address, address: Address, amount: bigint): Voucher;
    withdrawERC721(token: Address, address: Address, tokenId: bigint): Voucher;
    withdrawERC1155(
        token: Address,
        address: Address,
        tokenIds: bigint | bigint[],
        values: bigint | bigint[],
    ): Voucher;
}

export class WalletAppImpl implements WalletApp {
    private dapp?: Address;
    private wallets = new Map<string, Wallet>();

    setDapp = (address: Address): void => {
        this.dapp = address;
    };

    setWallet = (address: string, wallet: Wallet): void => {
        this.wallets.set(address, wallet);
    };

    getWalletOrNew = (address: string): Wallet => {
        if (isAddress(address)) {
            address = getAddress(address);
        }
        const wallet = this.wallets.get(address);

        if (wallet) {
            return wallet;
        }

        const newWallet = this.createDefaultWallet();
        this.wallets.set(address, newWallet);

        return newWallet;
    };

    createDefaultWallet(): Wallet {
        return {
            ether: 0n,
            erc20: new Map(),
            erc721: new Map(),
            erc1155: new Map(),
        };
    }

    /**
     *
     * @param tokenOrAddress
     * @param address
     * @returns
     */
    public balanceOf(
        tokenOrAddress: string | Address,
        address?: string,
    ): bigint {
        const handler = TokenHandler.getInstance();

        if (address && isAddress(address)) {
            return handler.erc20.balanceOf({
                address,
                getWallet: this.getWalletOrNew,
                tokenOrAddress,
            });
        } else {
            return handler.ether.balanceOf({
                getWallet: this.getWalletOrNew,
                tokenOrAddress,
            });
        }
    }

    public balanceOfERC721(
        address: string | Address,
        owner: string | Address,
    ): bigint {
        const ownerAddress = getAddress(owner);
        const wallet = this.getWalletOrNew(ownerAddress);
        if (isAddress(address)) {
            address = getAddress(address);
        }
        const size = wallet.erc721.get(address as Address)?.size ?? 0n;
        return BigInt(size);
    }

    public balanceOfERC1155(
        addresses: string | string[],
        tokenIds: bigint | bigint[],
        owner: string | Address,
    ): bigint | bigint[] {
        if (!this.isSameType(tokenIds, addresses)) {
            throw new Error(
                "addresses and tokenIds must be both arrays or not",
            );
        }

        if (!Array.isArray(addresses)) {
            addresses = [addresses];
        }
        if (!Array.isArray(tokenIds)) {
            tokenIds = [tokenIds];
        }

        if (addresses.length !== tokenIds.length) {
            throw new Error("addresses and tokenIds must have the same length");
        }

        const ownerAddress = getAddress(owner);
        const wallet = this.getWalletOrNew(ownerAddress);
        const balances: bigint[] = [];

        for (let i = 0; i < addresses.length; i++) {
            let address = addresses[i];
            if (isAddress(address)) {
                address = getAddress(address);
            }

            const tokenId = tokenIds[i];

            const collection = wallet.erc1155.get(address as Address);
            const item = collection?.get(tokenId) ?? 0n;
            balances.push(item);
        }

        if (balances.length === 1) {
            return balances[0];
        }

        return balances;
    }

    public handler: AdvanceRequestHandler = async (data) => {
        try {
            console.log("Wallet handler...", inspect(data, { depth: null }));

            const tokenHandler = TokenHandler.getInstance();
            const handler = tokenHandler.findDeposit(data);
            if (handler) {
                await handler.deposit({
                    setDapp: this.setDapp,
                    payload: data.payload,
                    getWallet: this.getWalletOrNew,
                    setWallet: this.setWallet,
                });

                return "accept";
            }
        } catch (e) {
            console.log("Error", e);
        }

        console.log("Wallet handler reject");
        // Otherwise, reject
        return "reject";
    };

    transferEther(from: string, to: string, amount: bigint): void {
        // normalize addresses
        if (isAddress(from)) {
            from = getAddress(from);
        }
        if (isAddress(to)) {
            to = getAddress(to);
        }

        const walletFrom = this.getWalletOrNew(from);
        const walletTo = this.getWalletOrNew(to);

        if (walletFrom.ether < amount) {
            throw new Error(`insufficient balance of user ${from}`);
        }

        walletFrom.ether = walletFrom.ether - amount;
        walletTo.ether = walletTo.ether + amount;
        this.wallets.set(from, walletFrom);
        this.wallets.set(to, walletTo);
    }

    transferERC20(
        token: Address,
        from: string,
        to: string,
        amount: bigint,
    ): void {
        // normalize addresses
        if (isAddress(from)) {
            from = getAddress(from);
        }
        if (isAddress(to)) {
            to = getAddress(to);
        }

        const walletFrom = this.getWalletOrNew(from);
        const walletTo = this.getWalletOrNew(to);

        const balance = walletFrom.erc20.get(token);

        if (!balance || balance < amount) {
            throw new Error(
                `insufficient balance of user ${from} of token ${token}`,
            );
        }

        const balanceFrom = balance - amount;
        walletFrom.erc20.set(token, balanceFrom);

        const balanceTo = walletTo.erc20.get(token);

        if (balanceTo) {
            walletTo.erc20.set(token, balanceTo + amount);
        } else {
            walletTo.erc20.set(token, amount);
        }

        this.wallets.set(from, walletFrom);
        this.wallets.set(to, walletTo);
    }

    transferERC721(
        token: Address,
        from: string,
        to: string,
        tokenId: bigint,
    ): void {
        // normalize addresses
        if (isAddress(from)) {
            from = getAddress(from);
        }
        if (isAddress(to)) {
            to = getAddress(to);
        }

        const walletFrom = this.getWalletOrNew(from);
        const walletTo = this.getWalletOrNew(to);

        const balance = walletFrom.erc721.get(token);

        if (!balance) {
            throw new Error(
                `insufficient balance of user ${from} of token ${token}`,
            );
        }

        if (!balance.has(tokenId)) {
            throw new Error(
                `user ${from} does not have token ${tokenId} of token ${token}`,
            );
        }

        let balanceTo = walletTo.erc721.get(token);
        if (!balanceTo) {
            balanceTo = new Set();
            walletTo.erc721.set(token, balanceTo);
        }
        balanceTo.add(tokenId);
        balance.delete(tokenId);

        this.wallets.set(from, walletFrom);
        this.wallets.set(to, walletTo);
    }

    transferERC1155(
        token: Address,
        from: string,
        to: string,
        tokenIds: bigint[],
        values: bigint[],
    ): void {
        if (tokenIds.length !== values.length) {
            throw new Error("tokenIds and values must have the same length");
        }

        if (isAddress(from)) {
            from = getAddress(from);
        }

        if (isAddress(to)) {
            to = getAddress(to);
        }

        const walletFrom = this.getWalletOrNew(from);
        const walletTo = this.getWalletOrNew(to);

        let nfts = walletFrom.erc1155.get(token);
        if (!nfts) {
            nfts = new Map();
            walletFrom.erc1155.set(token, nfts);
        }

        // check balance
        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const value = values[i];

            const item = nfts.get(tokenId) ?? 0n;

            if (value < 0n) {
                throw new Error(
                    `negative value for tokenId ${tokenId}: ${value}`,
                );
            }
            if (item < value) {
                throw new Error(
                    `insufficient balance of user ${from} of token ${tokenId}: ${value.toString()} > ${
                        item.toString() ?? "0"
                    }`,
                );
            }
        }

        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const value = values[i];
            const item = nfts.get(tokenId) ?? 0n;
            nfts.set(tokenId, item - value);
        }

        let nftsTo = walletTo.erc1155.get(token);
        if (!nftsTo) {
            nftsTo = new Map();
            walletTo.erc1155.set(token, nftsTo);
        }

        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const value = values[i];
            const item = nftsTo.get(tokenId) ?? 0n;
            nftsTo.set(tokenId, item + value);
        }

        this.wallets.set(from, walletFrom);
        this.wallets.set(to, walletTo);
    }

    withdrawEther(address: Address, amount: bigint): Voucher {
        // normalize address
        address = getAddress(address);

        const wallet = this.wallets.get(address);

        if (!wallet) {
            throw new Error(`wallet of user ${address} is undefined`);
        }

        // check if dapp address is defined
        if (!this.dapp) {
            throw new Error(`undefined application address`);
        }

        // check balance
        if (wallet.ether < amount) {
            throw new Error(
                `insufficient balance of user ${address}: ${amount.toString()} > ${wallet.ether.toString()}`,
            );
        }

        // reduce balance right away
        wallet.ether = wallet.ether - amount;

        // create voucher
        const call = encodeFunctionData({
            abi: cartesiDAppAbi,
            functionName: "withdrawEther",
            args: [address, amount],
        });
        return {
            destination: this.dapp, // dapp Address
            payload: call,
        };
    }

    withdrawERC20(token: Address, address: Address, amount: bigint): Voucher {
        // normalize addresses
        token = getAddress(token);
        address = getAddress(address);

        const wallet = this.wallets.get(address);

        if (!wallet) {
            throw new Error(`wallet of user ${address} is undefined`);
        }

        const balance = wallet?.erc20.get(token);

        // check balance
        if (!balance || balance < amount) {
            throw new Error(
                `insufficient balance of user ${address} of token ${token}: ${amount.toString()} > ${
                    balance?.toString() ?? "0"
                }`,
            );
        }

        // reduce balance right away
        wallet.erc20.set(token, balance - amount);

        const call = encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [address, amount],
        });

        // create voucher to the ERC-20 transfer
        return {
            destination: token,
            payload: call,
        };
    }

    isSameType(...args: unknown[]) {
        const allAreArr = args.every((arg) => Array.isArray(arg));
        const noneAreArr = args.every((arg) => !Array.isArray(arg));

        return allAreArr || noneAreArr;
    }

    withdrawERC721(token: Address, address: Address, tokenId: bigint): Voucher {
        token = getAddress(token);
        address = getAddress(address);

        const wallet = this.wallets.get(address);

        if (!wallet) {
            throw new Error(`wallet of user ${address} is undefined`);
        }

        const collection = wallet?.erc721.get(token);
        if (!collection) {
            throw new Error(
                `insufficient balance of user ${address} of token ${token}`,
            );
        }
        if (!collection.has(tokenId)) {
            throw new Error(
                `insufficient balance of user ${address} of token ${token} id ${tokenId}`,
            );
        }
        const dappAddress = this.getDappAddressOrThrow();

        collection.delete(tokenId);
        const call = encodeFunctionData({
            abi: erc721Abi,
            functionName: "safeTransferFrom",
            args: [dappAddress, address, tokenId],
        });
        return {
            destination: token,
            payload: call,
        };
    }

    getDappAddressOrThrow = (): Address => {
        if (!this.dapp) {
            throw new Error(
                `You need to call the method relayDAppAddress from DAppAddressRelay__factory.`,
            );
        }
        return this.dapp;
    };

    withdrawERC1155(
        token: Address,
        address: Address,
        tokenIds: bigint | bigint[],
        values: bigint | bigint[],
    ): Voucher {
        if (!this.isSameType(tokenIds, values)) {
            throw new Error(
                "tokenIds and values must be arrays or bigints both",
            );
        }

        if (!Array.isArray(tokenIds)) {
            tokenIds = [tokenIds];
        }

        if (!Array.isArray(values)) {
            values = [values];
        }

        if (!tokenIds.length || !values.length) {
            throw new Error("tokenIds and values must not be empty");
        }

        if (tokenIds.length !== values.length) {
            throw new Error(
                `tokenIds(size: ${tokenIds.length})) and values(size: ${values.length}) must have the same length`,
            );
        }

        // normalize addresses
        token = getAddress(token);
        address = getAddress(address);

        const wallet = this.getWalletOrNew(address);
        let nfts = wallet.erc1155.get(token);

        if (!nfts) {
            nfts = new Map();
            wallet.erc1155.set(token, nfts);
        }

        // check balance
        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const value = values[i];
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
            const value = values[i];
            const balance = nfts.get(tokenId) ?? 0n;
            nfts.set(tokenId, balance - value);
        }

        const dappAddress = this.getDappAddressOrThrow();
        let call = encodeFunctionData({
            abi: erc1155Abi,
            functionName: "safeBatchTransferFrom",
            args: [dappAddress, address, tokenIds, values, "0x"],
        });

        if (tokenIds.length === 1 && values.length === 1) {
            call = encodeFunctionData({
                abi: erc1155Abi,
                functionName: "safeTransferFrom",
                args: [dappAddress, address, tokenIds[0], values[0], "0x"],
            });
        }

        return {
            destination: token,
            payload: call,
        };
    }
}
