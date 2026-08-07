import fs from 'fs';
import Utils from './index.js';
import { z } from 'zod';

export class VMNetConfig {

    private static readonly basePath = Bun.env.CUSTOM_CONFIG_PATH || "/etc/lcmc-hosting/vm-net";
    private static readonly tempPath = Bun.env.CUSTOM_TEMP_PATH || "/var/tmp/lcmc-hosting/vm-net";
    private static config: VMNetConfig.Types.ConfigSchema;

    static loadConfig() {
        if (!this.config) {

            this.createConfigDir();
            const config = this.parseConfigFile();

            if (!config) {
                console.error("Failed to load config file");
                Utils.gracefulShutdown(1);
                return {} as VMNetConfig.Types.ConfigSchema;
            }

            this.config = config;
        }
        return this.config;
    }

    static copyConfigToTemp() {
        try {
            fs.copyFileSync(this.basePath + "/config.json", this.tempPath + "/last-up-config.json");
        } catch (error: any) {
            console.error(`Error copying config file to temp: ${error.stack}`);
        }
    }

    static loadLastUPConfig() {
        if (this.config) {
            return this.config;
        }

        const lastConfig = this.parseLastUPConfigFile();
        if (lastConfig) {
            return lastConfig;
        }
        return this.loadConfig();
    }

    static saveConfig(config: VMNetConfig.Types.ConfigSchema) {
        try {
            fs.writeFileSync(this.basePath + "/config.json", JSON.stringify(config, null, 4));
            this.config = config;
        } catch (error: any) {
            console.error(`Error saving config configuration: ${error.stack}`);
        }
    }


    private static createConfigDir() {
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
        }
        if (!fs.existsSync(this.tempPath)) {
            fs.mkdirSync(this.tempPath, { recursive: true });
        }
    }

    private static parseConfigFile() {
        const configFilePath = this.basePath + "/config.json";
        try {
            if (fs.existsSync(configFilePath)) {
                const configData = fs.readFileSync(configFilePath, "utf-8");
                return JSON.parse(configData) as VMNetConfig.Types.ConfigSchema;
            } else {
                fs.writeFileSync(configFilePath, JSON.stringify(this.defaultConfig, null, 4));
                return this.defaultConfig;
            }
        } catch (error: any) {
            console.error(`Error loading config configuration: ${error.stack}`);
            return null;
        }
    }

    private static parseLastUPConfigFile() {
        const lastConfigFilePath = this.tempPath + "/last-up-config.json";
        try {
            if (fs.existsSync(lastConfigFilePath)) {
                const configData = fs.readFileSync(lastConfigFilePath, "utf-8");
                return JSON.parse(configData) as VMNetConfig.Types.ConfigSchema;
            }
        } catch (error: any) {
            console.error(`Error loading temp config configuration: ${error.stack}`);
        }
        return null;
    }

    private static readonly defaultConfig: VMNetConfig.Types.ConfigSchema = {
        enabled: true,
        subnets: {}
    }

}


export namespace VMNetConfig.Types {

    export const PortORRange = z.string().or(z.number().int().min(1).max(65535))
    export type PortORRange = z.infer<typeof PortORRange>;

    export const NetRoutePort = z.union([
        z.object({
            pub: PortORRange,
            loc: PortORRange
        }),
        PortORRange
    ]);

    export type NetRoutePort = z.infer<typeof NetRoutePort>;

    export const NetRoute = z.object({
        ipv4: z.object({
            addr: z.string(),
            pubIface: z.string()
        }).optional(),
        ipv6: z.boolean().optional(),
        extraIPv6: z.array(z.string()).meta({ description: "0-9, a-f (added to server id" }).optional(),
        ports: z.array(NetRoutePort).optional()
    })

    export type NetRoute = z.infer<typeof NetRoute>;

    export const NetSubnet = z.object({
        pubIP4: z.string(),
        pubIP6Prefix: z.string(),
        pubIface: z.string(),
        locIface: z.string(),
        servers: z.record(
            z.string().meta({ description: "ServerID" }),
            NetRoute
        )
    });

    export type NetSubnet = z.infer<typeof NetSubnet>;

    export const ConfigSchema = z.object({
        enabled: z.boolean().default(true),
        subnets: z.record(
            z.string().meta({ description: "SubnetID" }),
            NetSubnet
        )
    })
    
    export type ConfigSchema = z.infer<typeof ConfigSchema>;

}