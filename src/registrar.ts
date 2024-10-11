import type { ConfigLike, NetInterfaceConfigLike, NetRouteLike } from "./configHandler.js";

class IPTablesCMD {
    protected static baseCMD = "iptables -t nat";

    static async enable(cmd: string) {
        const fullCMD = `${this.baseCMD} -A ${cmd}`;
        await Bun.$`${{raw: fullCMD}}`.quiet();
    }

    static async disable(cmd: string) {
        const fullCMD = `${this.baseCMD} -D ${cmd}`;
        await Bun.$`${{raw: fullCMD}}`.quiet();
    }

    static async run(enable: boolean, cmd: string) {
        const fullCMD = `${this.baseCMD} -${enable ? "A" : "D"} ${cmd}`;
        await Bun.$`${{raw: fullCMD}}`.quiet();
    }
}

class IP6TablesCMD extends IPTablesCMD {
    protected static baseCMD = "ip6tables -t nat";
}


class IPAddrCMD {

    protected static baseCMD = "ip addr -t nat";

    static async add(ipPrefix: string, subnet: number, server: number, iface: string) {
        const fullCMD = `${this.baseCMD} add ${ipPrefix}:${subnet}::${server} dev ${iface}`;
        await Bun.$`${{raw: fullCMD}}`.quiet();
    }

    static async disable(ipPrefix: string, subnet: number, server: number, iface: string) {
        const fullCMD = `${this.baseCMD} del ${ipPrefix}:${subnet}::${server} dev ${iface}`;
        await Bun.$`${{raw: fullCMD}}`.quiet();
    }

    static async run(enable: boolean, ipPrefix: string, subnet: number, server: number, iface: string) {
        const fullCMD = `${this.baseCMD} ${enable ? "add" : "del"} ${ipPrefix}:${subnet}::${server} dev ${iface}`;
        await Bun.$`${{raw: fullCMD}}`.quiet();
    }    

}

export class Registrar {

    static async register(config: ConfigLike) {
        if (config.enabled) {
            this.enableIPForwarding();
            this.runCMDs(true, config);
        }
    }

    static async unregister(config: ConfigLike) {
        if (config.enabled) {
            this.runCMDs(false, config);
        }
    }

    private static async runCMDs(enable: boolean, config: ConfigLike) {
        this.setupBasicPreRouting(enable);
        for (const iface of config.interfaces) {
            this.setupPerInterface(enable, iface);
        }
    }


    private static async enableIPForwarding() {
        await Bun.$`echo 1 > /proc/sys/net/ipv4/ip_forward`.quiet();
        await Bun.$`echo 1 > /proc/sys/net/ipv4/conf/all/proxy_arp`.quiet();

        await Bun.$`echo 1 > /proc/sys/net/ipv6/conf/all/forwarding`.quiet();
        await Bun.$`echo 1 > /proc/sys/net/ipv6/conf/all/proxy_ndp`.quiet();
    }


    private static async setupBasicPreRouting(enable: boolean) {
        await Bun.$`${{raw: `iptables -t raw -${enable ? "I" : "D"} PREROUTING -i fwbr+ -j CT --zone 1`}}`.quiet();
        await Bun.$`${{raw: `ip6tables -t raw -${enable ? "I" : "D"} PREROUTING -i fwbr+ -j CT --zone 1`}}`.quiet();
    }

    private static async setupPerInterface(enable: boolean, config: NetInterfaceConfigLike) {

        await IPTablesCMD.run(enable, `POSTROUTING -s '192.168.${config.subnet}.0/24' -o ${config.linuxIface} -j MASQUERADE`)
        await IP6TablesCMD.run(enable, `POSTROUTING -s 'fd00:${config.subnet}::/64' -o ${config.linuxIface} -j MASQUERADE`) 

        for (const route of config.routes) {
            await this.setupPerRoute(enable, route, config);
        }

    }

    private static async setupPerRoute(enable: boolean, config: NetRouteLike, ifaceConfig: Omit<NetInterfaceConfigLike, "routes">) {
        if (config.ipv6) {
            await IPAddrCMD.run(enable, ifaceConfig.publicIP6Prefix, ifaceConfig.subnet, config.server, ifaceConfig.linuxIface);
            await IP6TablesCMD.run(enable, `PREROUTING -p tcp -d ${ifaceConfig.publicIP6Prefix}:${ifaceConfig.subnet}::${config.server} -i ${ifaceConfig.linuxIface} -j DNAT --to-destination fd00:${ifaceConfig.subnet}::${config.server}`);
        }
    }


}


