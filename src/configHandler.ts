import fs from 'fs';
import Utils from './utils.js';

export interface ConfigLike {
    enabled: boolean;
    subnets: {[subnet: string]: NetSubnetConfigLike};
}

export interface NetSubnetConfigLike {
    publicIP4: string;
    publicIP6Prefix: string;
    targetIface: string;
    iface: string;
    servers: {[server: string]: NetRouteLike};
}

export interface NetRouteLike {
    ipv4?: {
        addr: string;
        targetIface: string;
    }
    ipv6?: boolean;
    extraIPv6: string[]; // 0-9, a-f (added to server id)
    ports?: NetRoutePortConfigLike[];
}

export type NetRoutePortConfigLike = {
    pub: string | number;
    local: string | number;
} | string | number;

export class ConfigHandler {

    private static readonly basePath = Bun.env.CUSTOM_CONFIG_PATH || "/etc/lcmc-hosting/vm-net";
    private static readonly tempPath = Bun.env.CUSTOM_TEMP_PATH || "/var/tmp/lcmc-hosting/vm-net";
    private static config: ConfigLike;

    static loadConfig() {
        if (!this.config) {

            this.createConfigDir();
            const config = this.parseConfigFile();

            if (!config) {
                console.error("Failed to load config file");
                Utils.gracefulShutdown(1);
                return {} as ConfigLike;
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

    static saveConfig(config: ConfigLike) {
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
                return JSON.parse(configData) as ConfigLike;
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
                return JSON.parse(configData) as ConfigLike;
            }
        } catch (error: any) {
            console.error(`Error loading temp config configuration: ${error.stack}`);
        }
        return null;
    }

    private static readonly defaultConfig: ConfigLike = {
        enabled: true,
        subnets: {}
    }

}


