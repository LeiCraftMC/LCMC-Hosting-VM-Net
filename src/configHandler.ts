import fs from 'fs';
import path from "path";
import Utils from './utils.js';

export interface NetRouteLike {
    server: number;
    ipv6: boolean;
}

export interface NetInterfaceConfigLike {
    subnet: number;
    publicIP4: string;
    publicIP6Prefix: string;
    linuxIface: string;
    routes: NetRouteLike[];
}

export interface ConfigLike {
    enabled: boolean;
    interfaces: NetInterfaceConfigLike[];
}


export class ConfigHandler {

    private static readonly basePath = Bun.env.CUSTOM_CONFIG_PATH || "/etc/lcmc-hosting/vm-net";
    private static config: ConfigLike;

    static loadConfig() {
        if (!this.config) {

            this.createConfigDir();
            const config = this.parseFile();

            if (!config) {
                console.error("Failed to load config file");
                Utils.gracefulShutdown(1);
                return {} as ConfigLike;
            }

            this.config = config;
        }
        return this.config;
    }

    static createConfigDir() {
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
        }
    }


    static parseFile() {
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

    private static readonly defaultConfig: ConfigLike = {
        enabled: true,
        interfaces: []
    }

}


