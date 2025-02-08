import { CLICMDHandler } from "./cli/app.js";

export default class Main {

    static async init() {
        const args = process.argv.slice(2);
        
        if (!args[0]) {
            args.push("help");
        }

        await CLICMDHandler.getInstance().run(
            args.map(arg => arg.toLowerCase())
                .filter(arg => arg),
        );
    }

}

Main.init();
