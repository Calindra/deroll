import { isValidAdvanceRequestData } from "./util";
import {
    InvalidPayloadError,
    MissingContextArgumentError,
    NotApplicableError,
} from "./errors";
import {
    getAddress,
    type Address,
    isHex,
    isAddress,
    encodeFunctionData,
    erc20Abi,
} from "viem";
import {
    cartesiDAppAbi,
    dAppAddressRelayAddress,
    erc1155BatchPortalAddress,
    erc1155SinglePortalAddress,
    erc20PortalAddress,
    erc721PortalAddress,
    etherPortalAddress,
} from "./rollups";
import type { Voucher } from "@deroll/app";
import {
    parseERC1155BatchDeposit,
    parseERC1155SingleDeposit,
    parseERC20Deposit,
    parseERC721Deposit,
    parseEtherDeposit,
} from ".";
import type { Wallet } from "./wallet";

export type TokenContext = Partial<{
    address: string;
    addresses: string[];
    tokenIds: bigint[];
    tokenId: bigint;
    token: Address;
    from: string;
    to: string;
    owner: string;
    amount: bigint;
    tokenOrAddress: string;
    recipient: Address;
    payload: string;
    getDapp(): Address;
    setDapp(address: Address): void;
    getWallet(address: string): Wallet;
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
    balanceOf<T extends bigint | bigint[]>({
        tokenOrAddress,
        getWallet,
    }: TokenContext): T {
        if (!tokenOrAddress || !getWallet)
            throw new MissingContextArgumentError<TokenContext>({
                tokenOrAddress,
                getWallet,
            });

        if (isAddress(tokenOrAddress)) {
            tokenOrAddress = getAddress(tokenOrAddress);
        }

        const wallet = getWallet(tokenOrAddress as Address);

        // ether balance
        return (wallet?.ether ?? 0n) as T;
    }
    transfer({ getWallet, from, to, amount, setWallet }: TokenContext): void {
        if (!from || !to || !amount || !getWallet || !setWallet) {
            throw new MissingContextArgumentError<TokenContext>({
                from,
                to,
                amount,
                getWallet,
                setWallet,
            });
        }

        const walletFrom = getWallet(from);
        const walletTo = getWallet(to);

        if (walletFrom.ether < amount) {
            throw new Error(`insufficient balance of user ${from}`);
        }

        walletFrom.ether = walletFrom.ether - amount;
        walletTo.ether = walletTo.ether + amount;
        setWallet(from as Address, walletFrom);
        setWallet(to as Address, walletTo);
    }
    withdraw({
        address,
        setWallet,
        getWallet,
        amount,
        getDapp,
    }: TokenContext): {
        destination: Address;
        payload: string;
    } {
        if (!address || !setWallet || !getWallet || !amount || !getDapp) {
            throw new MissingContextArgumentError<TokenContext>({
                address,
                setWallet,
                getWallet,
                amount,
                getDapp,
            });
        }

        // normalize address
        address = getAddress(address);

        const wallet = getWallet(address);

        if (!wallet) {
            throw new Error(`wallet of user ${address} is undefined`);
        }

        const dapp = getDapp();

        // check if dapp address is defined
        if (!dapp) {
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
            args: [address as Address, amount],
        });
        return {
            destination: dapp, // dapp Address
            payload: call,
        };
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === etherPortalAddress;
    }
    async deposit({
        payload,
        setWallet,
        getWallet,
    }: TokenContext): Promise<void> {
        console.log("Ether data");

        if (!payload || !isHex(payload) || !getWallet || !setWallet) {
            throw new MissingContextArgumentError<TokenContext>({
                payload,
                getWallet,
                setWallet,
            });
        }

        console.log("etherPortalAddress");
        const { sender, value } = parseEtherDeposit(payload);
        const wallet = getWallet(sender);
        wallet.ether += value;
        setWallet(sender, wallet);
    }
}

class ERC20 implements TokenOperation {
    balanceOf<T = bigint>({
        address,
        getWallet,
        tokenOrAddress,
    }: TokenContext): T {
        if (!address || !getWallet || !tokenOrAddress)
            throw new MissingContextArgumentError<TokenContext>({
                address,
                getWallet,
            });
        const addr = getAddress(address);

        const erc20address = getAddress(tokenOrAddress);
        const wallet = getWallet(addr);
        const result = wallet.erc20.get(erc20address) ?? 0n;
        return result as T;
    }
    transfer({
        token,
        from,
        to,
        amount,
        getWallet,
        setWallet,
    }: TokenContext): void {
        if (!token || !from || !to || !amount || !getWallet || !setWallet)
            throw new MissingContextArgumentError<TokenContext>({
                token,
                from,
                to,
                amount,
                getWallet,
                setWallet,
            });

        // normalize addresses
        if (isAddress(from)) {
            from = getAddress(from);
        }
        if (isAddress(to)) {
            to = getAddress(to);
        }

        const walletFrom = getWallet(from);
        const walletTo = getWallet(to);

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

        setWallet(from as Address, walletFrom);
        setWallet(to as Address, walletTo);
    }
    withdraw({ token, address, getWallet, amount }: TokenContext): {
        destination: Address;
        payload: string;
    } {
        if (!token || !address || !getWallet || !amount) {
            throw new MissingContextArgumentError<TokenContext>({
                token,
                address,
                getWallet,
                amount,
            });
        }

        // normalize addresses
        token = getAddress(token);
        address = getAddress(address);

        const wallet = getWallet(address);

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
            args: [address as Address, amount],
        });

        // create voucher to the ERC-20 transfer
        return {
            destination: token,
            payload: call,
        };
    }
    async deposit({
        payload,
        getWallet,
        setWallet,
    }: TokenContext): Promise<void> {
        console.log("ERC-20 data");

        if (!payload || !isHex(payload) || !getWallet || !setWallet) {
            throw new MissingContextArgumentError<TokenContext>({
                payload,
                getWallet,
                setWallet,
            });
        }

        const { success, token, sender, amount } = parseERC20Deposit(payload);
        if (success) {
            const wallet = getWallet(sender);

            const balance = wallet.erc20.get(token);

            if (balance) {
                wallet.erc20.set(token, balance + amount);
            } else {
                wallet.erc20.set(token, amount);
            }

            setWallet(sender, wallet);
        }
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc20PortalAddress;
    }
}
class ERC721 implements TokenOperation {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    balanceOf<T extends bigint | bigint[]>(context: TokenContext): T {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    transfer(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    withdraw(context: TokenContext): { destination: Address; payload: string } {
        throw new Error("Method not implemented.");
    }
    async deposit({
        payload,
        setWallet,
        getWallet,
    }: TokenContext): Promise<void> {
        console.log("ERC-721 data");

        if (!payload || !isHex(payload) || !setWallet || !getWallet) {
            throw new MissingContextArgumentError<TokenContext>({
                payload,
                setWallet,
                getWallet,
            });
        }

        const { token, sender, tokenId } = parseERC721Deposit(payload);

        const wallet = getWallet(sender);

        const collection = wallet.erc721.get(token);
        if (collection) {
            collection.add(tokenId);
        } else {
            const collection = new Set([tokenId]);
            wallet.erc721.set(token, collection);
        }
        setWallet(sender, wallet);
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc721PortalAddress;
    }
}
class ERC1155Batch implements TokenOperation {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    balanceOf<T extends bigint | bigint[]>(context: TokenContext): T {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    transfer(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    withdraw(context: TokenContext): { destination: Address; payload: string } {
        throw new Error("Method not implemented.");
    }
    async deposit({
        payload,
        setWallet,
        getWallet,
    }: TokenContext): Promise<void> {
        console.log("ERC-1155 batch");

        if (!payload || !isHex(payload) || !getWallet || !setWallet) {
            throw new MissingContextArgumentError<TokenContext>({
                payload,
                getWallet,
                setWallet,
            });
        }

        const { token, sender, tokenIds, values } =
            parseERC1155BatchDeposit(payload);

        const wallet = getWallet(sender);
        let collection = wallet.erc1155.get(token);
        if (!collection) {
            collection = new Map();
            wallet.erc1155.set(token, collection);
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

class ERC1155Single implements TokenOperation {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    balanceOf<T extends bigint | bigint[]>(context: TokenContext): T {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    transfer(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    withdraw(context: TokenContext): { destination: Address; payload: string } {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async deposit({
        payload,
        setWallet,
        getWallet,
    }: TokenContext): Promise<void> {
        console.log("ERC-1155 single");

        if (!payload || !isHex(payload) || !getWallet || !setWallet) {
            throw new MissingContextArgumentError<TokenContext>({
                payload,
                getWallet,
                setWallet,
            });
        }

        const { tokenId, sender, token, value } =
            parseERC1155SingleDeposit(payload);

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

class Relay implements TokenOperation {
    isDeposit(msgSender: Address): boolean {
        return msgSender === dAppAddressRelayAddress;
    }
    async deposit({ payload, setDapp }: TokenContext): Promise<void> {
        console.log("dAppAddressRelayAddress");

        if (!payload || !setDapp)
            throw new MissingContextArgumentError<TokenContext>({
                setDapp,
                payload,
            });
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
    private readonly handlers: Readonly<TokenOperation>[];

    public readonly ether = new Ether();
    public readonly erc20 = new ERC20();
    public readonly erc721 = new ERC721();
    public readonly erc1155Single = new ERC1155Single();
    public readonly erc1155Batch = new ERC1155Batch();
    public readonly relay = new Relay();

    /**
     * Singleton
     */
    private constructor() {
        this.handlers = [
            this.ether,
            this.erc20,
            this.erc721,
            this.erc1155Single,
            this.erc1155Batch,
            this.relay,
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
    public findDeposit(data: unknown): TokenOperation | undefined {
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
