import { Logger } from "./utils/logger";
import { CLIApp, CLICommandArg, CLICommandArgParser, CLICommandContext, type CLICMDExecEnv } from "@cleverjs/cli";
import { VersionCMD } from "./commands/versionCMD";
import { NetDownCMD, NetReloadCMD, NetUPCMD } from "./commands/basicControlCMDs";

new CLIApp({
    globalFlags: CLICommandArg.defineCLIFlagSpecs([
        {
            name: "log-level",
            type: "enum",
            allowedValues: ["debug" , "info" , "warn" , "error" , "critical"],
            description: "Set the log level for the application.",
            default: "info"
        }
    ]),
    logger: Logger,
    exitOnError: true
})
    .register(new VersionCMD())
    .register(new NetUPCMD())
    .register(new NetDownCMD())
    .register(new NetReloadCMD())

    .use(async (args, ctx, next) => {

        Logger.setLogLevel(args["log-level"]);

        return await next();
    })

    .handle(process.argv.slice(2), "shell");
