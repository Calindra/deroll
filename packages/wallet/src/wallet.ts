import { AdvanceRequestHandler, Voucher } from "@deroll/app";
import { Address, encodeFunctionData, getAddress, isAddress } from "viem";

import {
    cartesiDAppAbi,
    dAppAddressRelayAddress,
    erc20Abi,
    erc1155Abi,
} from "./rollups";
import {
    isERC20Deposit,
    isEtherDeposit,
    isERC721Deposit,
    isERC1155SingleDeposit,
    isERC1155BatchDeposit,
    parseERC20Deposit,
    parseEtherDeposit,
    parseERC721Deposit,
    parseERC1155SingleDeposit,
    parseERC1155BatchDeposit,
} from ".";
import { inspect } from "node:util";

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
    handler: AdvanceRequestHandler;
    transferEther(from: string, to: string, amount: bigint): void;
    transferERC20(
        token: Address,
        from: string,
        to: string,
        amount: bigint,
    ): void;
    withdrawEther(address: Address, amount: bigint): Voucher;
    withdrawERC20(token: Address, address: Address, amount: bigint): Voucher;
    createDefaultWallet(): Wallet;
    getWalletOrNew(address: string): Wallet;
}

export class WalletAppImpl implements WalletApp {
    private dapp?: Address;
    private wallets: Record<string, Wallet> = {};

    constructor() {
        this.handler = this.handler.bind(this);
    }

    getWalletOrNew(address: string): Wallet {
        return this.wallets[address] ?? this.createDefaultWallet();
    }

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
        if (address && isAddress(address)) {
            // if is address, normalize it
            if (isAddress(address)) {
                address = getAddress(address);
            }

            // erc-20 balance
            const erc20address = getAddress(tokenOrAddress);
            const wallet = this.getWalletOrNew(address);
            return wallet.erc20.get(erc20address) ?? 0n;
        } else {
            // if is address, normalize it
            if (isAddress(tokenOrAddress)) {
                tokenOrAddress = getAddress(tokenOrAddress);
            }

            // ether balance
            return this.wallets[tokenOrAddress]?.ether ?? 0n;
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
        addresses: string | Address | (string | Address)[],
        tokenIds: bigint | bigint[],
        owner: string | Address,
    ): bigint | bigint[] {
        if (!Array.isArray(addresses)) {
            addresses = [addresses];
        }
        const ownerAddress = getAddress(owner);
        const wallet = this.getWalletOrNew(ownerAddress);
        const addr = addresses.map((address) => getAddress(address));
        // const item = wallet.erc1155.get(address);
        /**
         * @todo implement balanceOfERC1155
         */
        throw new Error("Method not implemented.");
    }

    public handler: AdvanceRequestHandler = async (data) => {
        // Ether Deposit
        if (isEtherDeposit(data)) {
            const { sender, value } = parseEtherDeposit(data.payload);
            const wallet = this.getWalletOrNew(sender);
            wallet.ether += value;
            this.wallets[sender] = wallet;
            return "accept";
        }
        console.log("Wallet handler...", JSON.stringify(data, null, 4));

        // ERC20 Deposit
        if (isERC20Deposit(data)) {
            const { success, token, sender, amount } = parseERC20Deposit(
                data.payload,
            );
            console.log("ERC-20 data", { success, token, sender, amount });
            if (success) {
                const wallet = this.getWalletOrNew(sender);

                const balance = wallet.erc20.get(token);

                if (balance) {
                    wallet.erc20.set(token, balance + amount);
                } else {
                    wallet.erc20.set(token, amount);
                }

                this.wallets[sender] = wallet;
            }
            return "accept";
        }

        // ERC721 Deposit
        if (isERC721Deposit(data)) {
            console.log("ERC-721 data");
            const { token, sender, tokenId } = parseERC721Deposit(data.payload);

            const wallet = this.getWalletOrNew(sender);

            const collection = wallet.erc721.get(token);
            if (collection) {
                collection.add(tokenId);
            } else {
                const collection = new Set([tokenId]);
                wallet.erc721.set(token, collection);
            }
            console.log(inspect(this.wallets, { depth: null }));
            this.wallets[sender] = wallet;
            return "accept";
        }

        // ERC1155 Single Deposit
        if (isERC1155SingleDeposit(data)) {
            console.log("ERC-1155 single");
            const { tokenId, sender, token, value } = parseERC1155SingleDeposit(
                data.payload,
            );

            const wallet = this.getWalletOrNew(sender);
            let collection = wallet.erc1155.get(token);
            if (!collection) {
                collection = new Map();
                wallet.erc1155.set(token, collection);
            }
            const tokenBalance = collection.get(tokenId) ?? 0n;
            collection.set(tokenId, tokenBalance + value);
            this.wallets[sender] = wallet;
            console.log(inspect(wallet));
            return "accept";
        }

        // ERC1155 Batch Deposit
        if (isERC1155BatchDeposit(data)) {
            console.log("ERC-1155 batch");
            const { token, sender, tokenIds } = parseERC1155BatchDeposit(
                data.payload,
            );

            const wallet = this.getWalletOrNew(sender);
            let collection = wallet.erc1155.get(token);
            if (!collection) {
                collection = new Map();
                wallet.erc1155.set(token, collection);
            }

            for (let i = 0; i < tokenIds.length; i++) {
                const tokenId = tokenIds[i];
                const tokenBalance = collection.get(tokenId) ?? 0n;
                collection.set(tokenId, tokenBalance + 1n);
            }
            this.wallets[sender] = wallet;
            console.log(inspect(this));
            return "accept";
        }

        // Relay Address
        if (getAddress(data.metadata.msg_sender) === dAppAddressRelayAddress) {
            console.log("dAppAddressRelayAddress");
            this.dapp = getAddress(data.payload);
            return "accept";
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
        this.wallets[from] = walletFrom;
        this.wallets[to] = walletTo;
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

        this.wallets[from] = walletFrom;
        this.wallets[to] = walletTo;
    }

    withdrawEther(address: Address, amount: bigint): Voucher {
        // normalize address
        address = getAddress(address);

        const wallet = this.wallets[address];

        // check if dapp address is defined
        if (!this.dapp) {
            throw new Error(`undefined application address`);
        }

        // check balance
        if (!wallet || wallet.ether < amount) {
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

        const wallet = this.wallets[address];
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

        // create voucher to the IERC20 transfer
        return {
            destination: token,
            payload: call,
        };
    }

    withdrawERC1155(
        token: Address,
        address: Address,
        tokenIds: bigint | bigint[],
        values: bigint | bigint[],
    ): Voucher {
        // check arguments consistency
        // const tokenIdsIsArr = Array.isArray(tokenIds);
        // const valuesIsArr = Array.isArray(values);
        //
        // if ((tokenIdsIsArr || valuesIsArr) && !(tokenIdsIsArr && valuesIsArr)) {
        //     throw new Error(
        //         "tokenIds and values must be arrays or bigints both",
        //     );
        // }

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

        let call = encodeFunctionData({
            abi: erc1155Abi,
            functionName: "safeBatchTransferFrom",
            args: [token, address, tokenIds, values, "0x"],
        });

        if (tokenIds.length === 1 && values.length === 1) {
            call = encodeFunctionData({
                abi: erc1155Abi,
                functionName: "safeTransferFrom",
                args: [token, address, tokenIds[0], values[0], "0x"],
            });
        }

        return {
            destination: token,
            payload: call,
        };
    }
}
