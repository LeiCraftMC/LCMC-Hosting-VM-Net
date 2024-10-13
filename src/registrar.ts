import type { ConfigLike, NetInterfaceConfigLike, NetRouteLike } from "./configHandler.js";

class ShellCMD {
    static async run(cmd: string) {
        console.log(`Running: ${cmd}`);
        await Bun.$`${{raw: cmd}}`.quiet();
    }
}

class IPTablesCMD {
    protected static baseCMD = "iptables -t nat";

    static async enable(cmd: string) {
        const fullCMD = `${this.baseCMD} -A ${cmd}`;
        await ShellCMD.run(fullCMD);
    }

    static async disable(cmd: string) {
        const fullCMD = `${this.baseCMD} -D ${cmd}`;
        await ShellCMD.run(fullCMD);
    }

    static async run(enable: boolean, cmd: string) {
        const fullCMD = `${this.baseCMD} -${enable ? "A" : "D"} ${cmd}`;
        await ShellCMD.run(fullCMD);
    }
}

class IP6TablesCMD extends IPTablesCMD {
    protected static baseCMD = "ip6tables -t nat";
}


class IPAddrCMD {

    protected static baseCMD = "ip addr";

    static async add(ipPrefix: string, subnet: number, server: number, iface: string) {
        const fullCMD = `${this.baseCMD} add ${ipPrefix}:${subnet}::${server} dev ${iface}`;
        await ShellCMD.run(fullCMD);
    }

    static async disable(ipPrefix: string, subnet: number, server: number, iface: string) {
        const fullCMD = `${this.baseCMD} del ${ipPrefix}:${subnet}::${server} dev ${iface}`;
        await ShellCMD.run(fullCMD);
    }

    static async run(enable: boolean, ipPrefix: string, subnet: number, server: number, iface: string) {
        const fullCMD = `${this.baseCMD} ${enable ? "add" : "del"} ${ipPrefix}:${subnet}::${server} dev ${iface}`;
        await ShellCMD.run(fullCMD);
    }

}

export class Registrar {

    static async register(config: ConfigLike) {
        if (config.enabled) {
            await Promise.all([
                this.enableIPForwarding(),
                this.runCMDs(true, config)
            ]);
        }
    }

    static async unregister(config: ConfigLike) {
        if (config.enabled) {
            await this.runCMDs(false, config);
        }
    }

    private static async runCMDs(enable: boolean, config: ConfigLike) {
        const promises: Promise<void>[] = [];

        promises.push(this.setupBasicPreRouting(enable));

        for (const iface of config.interfaces) {
            promises.push(this.setupPerInterface(enable, iface));
        }

        await Promise.all(promises);
    }


    private static async enableIPForwarding() {
        await Promise.all([
            ShellCMD.run("echo 1 > /proc/sys/net/ipv4/ip_forward"),
            ShellCMD.run("echo 1 > /proc/sys/net/ipv4/conf/all/proxy_arp"),

            ShellCMD.run("echo 1 > /proc/sys/net/ipv6/conf/all/forwarding"),
            ShellCMD.run("echo 1 > /proc/sys/net/ipv6/conf/all/proxy_ndp")
        ])
    }


    private static async setupBasicPreRouting(enable: boolean) {
        await ShellCMD.run(`iptables -t raw -${enable ? "I" : "D"} PREROUTING -i fwbr+ -j CT --zone 1`);
        await ShellCMD.run(`ip6tables -t raw -${enable ? "I" : "D"} PREROUTING -i fwbr+ -j CT --zone 1`);
    }

    private static async setupPerInterface(enable: boolean, config: NetInterfaceConfigLike) {

        await IPTablesCMD.run(enable, `POSTROUTING -s '192.168.${config.subnet}.0/24' -o ${config.linuxIface} -j MASQUERADE`)
        await IP6TablesCMD.run(enable, `POSTROUTING -s 'fd00:${config.subnet}::/64' -o ${config.linuxIface} -j MASQUERADE`) 

        const promises: Promise<void>[] = [];

        for (const route of config.routes) {
            promises.push(this.setupPerRoute(enable, route, config));
        }

        await Promise.all(promises);
    }

    private static async setupPerRoute(enable: boolean, config: NetRouteLike, ifaceConfig: Omit<NetInterfaceConfigLike, "routes">) {
        if (config.ipv6) {
            await IPAddrCMD.run(enable, ifaceConfig.publicIP6Prefix, ifaceConfig.subnet, config.server, ifaceConfig.linuxIface);
            await IP6TablesCMD.run(enable, `PREROUTING -p tcp -d ${ifaceConfig.publicIP6Prefix}:${ifaceConfig.subnet}::${config.server} -i ${ifaceConfig.linuxIface} -j DNAT --to-destination fd00:${ifaceConfig.subnet}::${config.server}`);
        }
    }

}


