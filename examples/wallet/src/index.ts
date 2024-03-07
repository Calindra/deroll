import { createApp } from "@deroll/app";
import { createRouter } from "@deroll/router";
import { createWallet } from "@deroll/wallet";

async function main() {
    // create app
    const app = createApp({ url: "http://127.0.0.1:8080/rollup" });

    // create wallet
    const wallet = createWallet();

    const router = createRouter({ app });
    router.add<{ address: string }>(
        "wallet/:address",
        ({ params: { address } }) => {
            return JSON.stringify({
                balance: wallet.balanceOf(address),
            });
        },
    );

    app.addAdvanceHandler(wallet.handler);
    app.addInspectHandler(router.handler);

    // start app
    await app.start().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}

main();

