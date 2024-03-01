import { beforeEach, describe, expect, test } from "vitest";
import { Address, Hex, bytesToHex, encodePacked } from "viem";

import {
    createWallet,
    isERC20Deposit,
    isERC721Deposit,
    isERC1155SingleDeposit,
    isERC1155BatchDeposit,
    isEtherDeposit,
    parseERC1155BatchDeposit,
    parseERC1155SingleDeposit,
    parseEtherDeposit,
} from "../src";
import {
    erc20PortalAddress,
    erc721PortalAddress,
    erc1155SinglePortalAddress,
    erc1155BatchPortalAddress,
    etherPortalAddress,
} from "../src/rollups";
import { getRandomValues } from "node:crypto";

function generateAddress(): Address {
    const address = new Uint8Array(20);
    const random = getRandomValues(address);
    return bytesToHex(random);
}

describe("Wallet", () => {
    beforeEach(() => {});

    describe("should be able to check if is deposit", () => {
        test("isEtherDeposit", () => {
            expect(
                isEtherDeposit({
                    metadata: {
                        msg_sender: etherPortalAddress,
                        block_number: 0,
                        epoch_index: 0,
                        input_index: 0,
                        timestamp: 0,
                    },
                    payload: "0xdeadbeef",
                }),
            ).toBeTruthy();

            expect(
                isEtherDeposit({
                    metadata: {
                        msg_sender: etherPortalAddress.toLowerCase() as Address,
                        block_number: 0,
                        epoch_index: 0,
                        input_index: 0,
                        timestamp: 0,
                    },
                    payload: "0xdeadbeef",
                }),
            ).toBeTruthy();

            expect(
                isEtherDeposit({
                    metadata: {
                        msg_sender: erc20PortalAddress,
                        block_number: 0,
                        epoch_index: 0,
                        input_index: 0,
                        timestamp: 0,
                    },
                    payload: "0xdeadbeef",
                }),
            ).toBeFalsy();
        });

        test("isERC20Deposit", () => {
            expect(
                isERC20Deposit({
                    metadata: {
                        msg_sender: erc20PortalAddress,
                        block_number: 0,
                        epoch_index: 0,
                        input_index: 0,
                        timestamp: 0,
                    },
                    payload: "0xdeadbeef",
                }),
            ).toBeTruthy();

            expect(
                isERC20Deposit({
                    metadata: {
                        msg_sender: erc20PortalAddress.toLowerCase() as Address,
                        block_number: 0,
                        epoch_index: 0,
                        input_index: 0,
                        timestamp: 0,
                    },
                    payload: "0xdeadbeef",
                }),
            ).toBeTruthy();

            expect(
                isERC20Deposit({
                    metadata: {
                        msg_sender: etherPortalAddress,
                        block_number: 0,
                        epoch_index: 0,
                        input_index: 0,
                        timestamp: 0,
                    },
                    payload: "0xdeadbeef",
                }),
            ).toBeFalsy();
        });

        test("isERC721Deposit", () => {
            expect(
                isERC721Deposit({
                    metadata: {
                        msg_sender: erc721PortalAddress,
                        block_number: 0,
                        epoch_index: 0,
                        input_index: 0,
                        timestamp: 0,
                    },
                    payload: "0xdeadbeef",
                }),
            ).toBeTruthy();
        });

        test("isERC1155Deposit", () => {
            expect(
                isERC1155SingleDeposit({
                    metadata: {
                        msg_sender: erc1155SinglePortalAddress,
                        block_number: 0,
                        epoch_index: 0,
                        input_index: 0,
                        timestamp: 0,
                    },
                    payload: "0xdeadbeef",
                }),
            ).toBeTruthy();

            expect(
                isERC1155BatchDeposit({
                    metadata: {
                        msg_sender: erc1155BatchPortalAddress,
                        block_number: 0,
                        epoch_index: 0,
                        input_index: 0,
                        timestamp: 0,
                    },
                    payload: "0xdeadbeef",
                }),
            ).toBeTruthy();
        });
    });

    describe("should be able to parse deposit", () => {
        test("parseEtherDeposit", () => {
            const sender = "0x18930e8a66a1DbE21D00581216789AAB7460Afd0";
            const value = 123456n;
            const payload = encodePacked(
                ["address", "uint256"],
                [sender, value],
            );
            const deposit = parseEtherDeposit(payload);
            expect(deposit).toEqual({
                sender,
                value,
            });
        });

        test.todo("parseERC20Deposit", () => {});
        test.todo("parseERC721Deposit", () => {});

        test("parseERC1155SingleDeposit", async () => {
            const address = "0xf252ee8851e87c530de36e798a0e2f28ce100477";
            const sender = "0x18930e8a66a1dbe21d00581216789aab7460afd0";
            const tokenId = 123456n;
            const value = 1n;

            // const payload =
            // "0xf252ee8851e87c530de36e798a0e2f28ce10047718930e8a66a1dbe21d00581216789aab7460afd0000000000000000000000000000000000000000000000000000000000001e240000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
            const payload = encodePacked(
                ["address", "address", "uint256", "uint256", "bytes", "bytes"],
                [address, sender, tokenId, value, "0x", "0x"],
            );

            const result = parseERC1155SingleDeposit(payload);
            expect(result.token.toLowerCase()).toEqual(
                "0xf252ee8851e87c530de36e798a0e2f28ce100477",
            );
            expect(result.sender.toLowerCase()).toEqual(
                "0x18930e8a66a1dbe21d00581216789aab7460afd0",
            );
            expect(result.tokenId).toEqual(123456n);
            expect(result.value).toEqual(1n);
        });

        test("parseERC1155BatchDeposit", async () => {
            const payload = `0x3aa5ebb10dc797cac828524e59a333d0a371443cf39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`;
            // const payload = `0x3aa5ebb10dc797cac828524e59a333d0a371443c <- address
            //                    f39fd6e51aad88f6f4ce6ab8827279cfffb92266 <- address
            // 0000000000000000000000000000000000000000000000000000000000000080 <- offset
            // 00000000000000000000000000000000000000000000000000000000000000e0 <- offset
            // 0000000000000000000000000000000000000000000000000000000000000140 <- offset
            // 0000000000000000000000000000000000000000000000000000000000000160 <- offset
            // 0000000000000000000000000000000000000000000000000000000000000002 <- array tokenIds length
            // 0000000000000000000000000000000000000000000000000000000000000003    <- tokenIds[0] = 3
            // 0000000000000000000000000000000000000000000000000000000000000004    <- tokenIds[1] = 4
            // 0000000000000000000000000000000000000000000000000000000000000002 <- array values length
            // 0000000000000000000000000000000000000000000000000000000000000005    <- values[0] = 5
            // 0000000000000000000000000000000000000000000000000000000000000007    <- values[0] = 7
            // 0000000000000000000000000000000000000000000000000000000000000000 <- bytes len
            // 0000000000000000000000000000000000000000000000000000000000000000 <- bytes len
            // `;
            const result = parseERC1155BatchDeposit(payload);
            expect(result.token.toLowerCase()).toEqual(
                "0x3aa5ebb10dc797cac828524e59a333d0a371443c",
            );
            expect(result.sender.toLowerCase()).toEqual(
                "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
            );
            expect(result.tokenIds.length).toEqual(2);
            expect(result.tokenIds).toEqual([3n, 4n]);
            expect(result.values.length).toEqual(2);
            expect(result.values).toEqual([5n, 7n]);
        });
    });

    describe("should be able to deposit", () => {
        test("deposit ETH", async () => {
            const wallet = createWallet();
            const sender = "0x18930e8a66a1DbE21D00581216789AAB7460Afd0";
            const value = 123456n;
            const payload = encodePacked(
                ["address", "uint256"],
                [sender, value],
            );
            const metadata = {
                msg_sender: etherPortalAddress,
                block_number: 0,
                epoch_index: 0,
                input_index: 0,
                timestamp: 0,
            };
            const response = await wallet.handler({ metadata, payload });
            expect(response).toEqual("accept");
            expect(wallet.balanceOf(sender)).toEqual(value);
        });

        test("deposit ETH non normalized address", async () => {
            const wallet = createWallet();
            const sender = "0x18930e8a66a1DbE21D00581216789AAB7460Afd0";
            const value = 123456n;
            const payload = encodePacked(
                ["address", "uint256"],
                [sender, value],
            );
            const metadata = {
                msg_sender: etherPortalAddress,
                block_number: 0,
                epoch_index: 0,
                input_index: 0,
                timestamp: 0,
            };
            const response = await wallet.handler({ metadata, payload });
            expect(response).toEqual("accept");
            expect(wallet.balanceOf(sender.toLowerCase())).toEqual(value);
        });

        test("deposit ERC20", async () => {
            const wallet = createWallet();
            const token = generateAddress();
            const amount = 123456n;
            const sender = "0x18930e8a66a1DbE21D00581216789AAB7460Afd0";
            const metadata = {
                msg_sender: erc20PortalAddress,
                block_number: 0,
                epoch_index: 0,
                input_index: 0,
                timestamp: 0,
            };

            const payload = encodePacked(
                ["bool", "address", "address", "uint256", "bytes"],
                [true, token, sender, amount, "0x"],
            );

            const response = await wallet.handler({ metadata, payload });
            expect(response).toEqual("accept");
            expect(wallet.balanceOf(token, sender)).toEqual(amount);
        });

        test("deposit ERC721", async () => {
            const token = generateAddress();
            const sender = "0x18930e8a66a1DbE21D00581216789AAB7460Afd0";
            const tokenId = 123456n;

            const wallet = createWallet();
            const metadata = {
                msg_sender: erc721PortalAddress,
                block_number: 0,
                epoch_index: 0,
                input_index: 0,
                timestamp: 0,
            };

            const payload = encodePacked(
                ["address", "address", "uint256", "bytes", "bytes"],
                [token, sender, tokenId, "0x", "0x"],
            ) as Hex;

            const response = await wallet.handler({ metadata, payload });
            expect(response).toEqual("accept");
            expect(wallet.balanceOfERC721(token, sender)).toEqual(1n);
        });

        test("deposit ERC1155", async () => {
            const wallet = createWallet();
            const token = generateAddress();
            const sender = "0x18930e8a66a1DbE21D00581216789AAB7460Afd0";
            const transfers = new Map([
                [123456n, 1n],
                [123457n, 2n],
                [123458n, 3n],
            ]);

            const metadata = {
                msg_sender: parseERC1155BatchDeposit,
                block_number: 0,
                epoch_index: 0,
                input_index: 0,
                timestamp: 0,
            };

            const payload = encodePacked(
                [
                    "address",
                    "address",
                    "uint256[]",
                    "uint256[]",
                    "bytes",
                    "bytes",
                ],
                [
                    token,
                    sender,
                    [...transfers.keys()],
                    [...transfers.values()],
                    "0x",
                    "0x",
                ],
            );
        });
    });

    describe("should be able to transfer", () => {
        test.todo("transfer ETH without balance", () => {});

        test("transfer ETH", async () => {
            const wallet = createWallet();
            const sender = "0x18930e8a66a1DbE21D00581216789AAB7460Afd0";
            const value = 123456n;

            const metadata = {
                msg_sender: etherPortalAddress,
                block_number: 0,
                epoch_index: 0,
                input_index: 0,
                timestamp: 0,
            };

            const payload = encodePacked(
                ["address", "uint256"],
                [sender, value],
            );

            const response = await wallet.handler({ metadata, payload });
            expect(response).toEqual("accept");
        });

        test.todo("transfer ERC20 without balance", () => {});

        test.todo("transfer ERC20", () => {});
        test.todo("transfer ERC721 without balance", () => {});

        test("transfer ERC721", async () => {
            const from = generateAddress();
            const to = "0x18930e8a66a1DbE21D00581216789AAB7460Afd0";

            const wallet = createWallet();
            const tokenId = 123456n;
            const metadata = {
                msg_sender: erc721PortalAddress,
                block_number: 0,
                epoch_index: 0,
                input_index: 0,
                timestamp: 0,
            };

            const payload = encodePacked(
                ["address", "address", "uint256", "bytes", "bytes"],
                [from, to, tokenId, "0x", "0x"],
            );

            const response = await wallet.handler({ metadata, payload });
            expect(response).toEqual("accept");
        });
        test.todo("transfer ERC1155 without balance", () => {});
        test.todo("transfer ERC1155", () => {});
    });

    describe("should be able to withdraw", () => {
        test.todo("withdraw ETH with no balance", () => {});

        test.todo("withdraw ETH with undefined portal address", () => {});

        test.todo("withdraw ETH", () => {});

        test.todo("withdraw ERC20", () => {});

        test.todo("withdraw ERC20 with no balance", () => {});
    });

    describe("Wallet with Route", () => {
        describe("should be able to deposit", () => {
            test.todo("depositEtherRoute reject", () => {});

            test.todo("depositEtherRoute", () => {});

            test.todo("depositERC20Route reject", () => {});

            test.todo("depositERC20Route", () => {});
        });

        describe("should be able to withdraw", () => {
            test.todo("withdrawEtherRoute reject no balance", async () => {});

            test.todo("withdrawEtherRoute", async () => {});

            test.todo("withdrawERC20Route reject no balance", async () => {});

            test.todo("withdrawERC20Route", async () => {});
        });
    });
});
