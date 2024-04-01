import { Address, getAddress, isAddress } from "viem";
import { AdvanceRequestHandler, Voucher } from "@deroll/app";

import {
    ether,
    erc20,
    erc721,
    erc1155Single,
    erc1155Batch,
    relay,
} from "./contracts";

import { RelayError } from "./errors";
import {
    etherPortalAddress,
    erc20PortalAddress,
    erc721PortalAddress,
    erc1155SinglePortalAddress,
    erc1155BatchPortalAddress,
    dAppAddressRelayAddress,
} from "./rollups";

export type Wallet = {
    ether: bigint;
    erc20: Record<string, bigint | undefined>;
    erc721: Record<string, Set<bigint> | undefined>;
    erc1155: Record<string, Map<bigint, bigint> | undefined>;
};

export interface WalletApp {
    /**
     * @deprecated use {@link balanceOfEther} instead
     */
    balanceOf(address: string): bigint;
    /**
     * @deprecated use {@link balanceOfERC20} instead
     */
    balanceOf(token: Address, address: string): bigint;
    balanceOfEther(address: string): bigint;
    balanceOfERC20(token: Address, address: string): bigint;
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
    private wallets: Record<string, Wallet | undefined> = {};

    private readonly handlers: Record<Address, AdvanceRequestHandler>;

    constructor() {
        this.handlers = {
            [etherPortalAddress]: ether.handler,
            [erc20PortalAddress]: erc20.handler,
            [erc721PortalAddress]: erc721.handler,
            [erc1155SinglePortalAddress]: erc1155Single.handler,
            [erc1155BatchPortalAddress]: erc1155Batch.handler,
            [dAppAddressRelayAddress]: relay.handler,
        };
    }

    getDappAddressOrThrow = (): Address => {
        if (!this.dapp) {
            throw new RelayError();
        }
        return this.dapp;
    };

    setDapp = (address: Address): void => {
        this.dapp = address;
    };

    setWallet = (address: string, wallet: Wallet): void => {
        this.wallets[address] = wallet;
    };

    getWalletOrNew = (address: string): Wallet => {
        if (isAddress(address)) {
            address = getAddress(address);
        }
        const wallet = this.wallets[address];

        if (wallet) {
            return wallet;
        }

        const newWallet = this.createDefaultWallet();
        this.wallets[address] = newWallet;

        return newWallet;
    };

    createDefaultWallet(): Wallet {
        return {
            ether: 0n,
            erc20: {},
            erc721: {},
            erc1155: {},
        };
    }

    balanceOfEther(tokenOrAddress: string): bigint {
        return ether.balanceOf({
            getWallet: this.getWalletOrNew,
            address: tokenOrAddress,
        });
    }

    balanceOfERC20(tokenOrAddress: Address, address: string): bigint {
        if (isAddress(address)) {
            address = getAddress(address);
        }

        return erc20.balanceOf({
            address,
            getWallet: this.getWalletOrNew,
            tokenOrAddress,
        });
    }

    /**
     *
     * @param tokenOrAddress
     * @param address
     * @returns
     * @deprecated use {@link balanceOfEther} or {@link balanceOfERC20} instead
     */
    public balanceOf(
        tokenOrAddress: string | Address,
        address?: string,
    ): bigint {
        if (address && isAddress(address)) {
            return erc20.balanceOf({
                address,
                getWallet: this.getWalletOrNew,
                tokenOrAddress,
            });
        } else {
            return ether.balanceOf({
                getWallet: this.getWalletOrNew,
                address: tokenOrAddress,
            });
        }
    }

    public balanceOfERC721(address: string | Address, owner: Address): bigint {
        return erc721.balanceOf({
            address,
            getWallet: this.getWalletOrNew,
            owner,
        });
    }

    public balanceOfERC1155(
        addresses: Address | Address[],
        tokenIds: bigint | bigint[],
        owner: string | Address,
    ): bigint | bigint[] {
        if (!Array.isArray(addresses) && !Array.isArray(tokenIds)) {
            const address = addresses;
            const tokenId = tokenIds;

            return erc1155Single.balanceOf({
                address,
                tokenId,
                owner,
                getWallet: this.getWalletOrNew,
            });
        }

        if (!Array.isArray(addresses)) {
            addresses = [addresses];
        }

        if (!Array.isArray(tokenIds)) {
            tokenIds = [tokenIds];
        }

        return erc1155Batch.balanceOf({
            addresses,
            tokenIds,
            owner,
            getWallet: this.getWalletOrNew,
        });
    }

    public handler: AdvanceRequestHandler = async (data) => {
        try {
            const msgSender = getAddress(data.metadata.msg_sender);
            const handler = this.handlers[msgSender];
            if (handler) {
                return handler(data);
            }
        } catch (e) {
            console.error("Error", e);
        }

        // Otherwise, reject
        return "reject";
    };

    transferEther(from: string, to: string, amount: bigint): void {
        ether.transfer({
            from,
            to,
            amount,
            getWallet: this.getWalletOrNew,
            setWallet: this.setWallet,
        });
    }

    transferERC20(
        token: Address,
        from: string,
        to: string,
        amount: bigint,
    ): void {
        erc20.transfer({
            token,
            from,
            to,
            amount,
            getWallet: this.getWalletOrNew,
            setWallet: this.setWallet,
        });
    }

    transferERC721(
        token: Address,
        from: string,
        to: string,
        tokenId: bigint,
    ): void {
        erc721.transfer({
            token,
            from,
            to,
            tokenId,
            getWallet: this.getWalletOrNew,
            setWallet: this.setWallet,
        });
    }

    transferERC1155(
        token: Address,
        from: string,
        to: string,
        tokenIds: bigint[],
        values: bigint[],
    ): void {
        if (!Array.isArray(tokenIds) && !Array.isArray(values)) {
            erc1155Single.transfer({
                token,
                from,
                to,
                tokenId: tokenIds,
                amount: values,
                getWallet: this.getWalletOrNew,
                setWallet: this.setWallet,
            });
        }

        if (!Array.isArray(tokenIds)) {
            tokenIds = [tokenIds];
        }

        if (!Array.isArray(values)) {
            values = [values];
        }

        erc1155Batch.transfer({
            token,
            from,
            to,
            tokenIds,
            amounts: values,
            getWallet: this.getWalletOrNew,
            setWallet: this.setWallet,
        });
    }

    withdrawEther(address: Address, amount: bigint): Voucher {
        return ether.withdraw({
            address,
            getWallet: this.getWalletOrNew,
            amount,
            getDapp: this.getDappAddressOrThrow,
        });
    }

    withdrawERC20(token: Address, address: Address, amount: bigint): Voucher {
        return erc20.withdraw({
            token,
            address,
            amount,
            getWallet: this.getWalletOrNew,
        });
    }

    withdrawERC721(token: Address, address: Address, tokenId: bigint): Voucher {
        return erc721.withdraw({
            token,
            address,
            tokenId,
            getWallet: this.getWalletOrNew,
            setWallet: this.setWallet,
            getDapp: this.getDappAddressOrThrow,
        });
    }



    withdrawERC1155(
        token: Address,
        address: Address,
        tokenIds: bigint | bigint[],
        amounts: bigint | bigint[],
    ): Voucher {
        if (!Array.isArray(tokenIds) && !Array.isArray(amounts)) {
            return erc1155Single.withdraw({
                token,
                address,
                tokenId: tokenIds,
                amount: amounts,
                getWallet: this.getWalletOrNew,
                getDapp: this.getDappAddressOrThrow,
            });
        }

        if (!Array.isArray(tokenIds)) {
            tokenIds = [tokenIds];
        }

        if (!Array.isArray(amounts)) {
            amounts = [amounts];
        }

        return erc1155Batch.withdraw({
            token,
            address,
            tokenIds,
            amounts,
            getWallet: this.getWalletOrNew,
            getDapp: this.getDappAddressOrThrow,
        });
    }
}
