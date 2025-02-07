import { Service } from "./service";

export type Dict<T, K extends string | number = string> = Record<K, T>;

class Utils {
    private static initialized = false;

    static get procCWD() {
        return process.cwd();
    }

    static init() {
        if (this.initialized) return;
        this.initialized = true;
        
        process.once("SIGINT", Utils.gracefulShutdown.bind(Utils, 0));
        process.once("SIGTERM", Utils.gracefulShutdown.bind(Utils, 0));

        process.once("uncaughtException", Utils.uncaughtException);
        process.once("unhandledRejection", Utils.unhandledRejection);
    }

    private static runStatus: "running" | "shutdown" | "shutdown_on_error" = "running";
    static getRunStatus() { return this.runStatus; }

    static async gracefulShutdown(exitCode: number = 0) {
        try {
            this.runStatus = exitCode === 0 ? "shutdown" : "shutdown_on_error";
            
            if (Service.isRunning === true) {
                await Service.stop();
            }

            console.log('Shutting down...');

            process.exit(exitCode);
        } catch (error: any) {
            console.error(`Uncaught Exception:\n${error.stack}`);
            this.forceShutdown();
        }
    }


    private static forceShutdown() {
        process.once("SIGTERM", ()=>{});
        process.exit(1);
    }

    private static async uncaughtException(error: Error) {
        console.error(`Uncaught Exception:\n${error.stack}`);
        Utils.gracefulShutdown(1);
    }

    private static async unhandledRejection(reason: any) {
        if (reason.stack) {
            // reason is an error
            return Utils.uncaughtException(reason);
        }
        console.error(`Unhandled Rejection:\n${reason}`);
        Utils.gracefulShutdown(1);
    }

}

Utils.init();
export default Utils;
