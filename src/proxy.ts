import net from "net";
import dgram from "dgram";
import type { SocketHandler } from "bun";
import { type Dict } from "./utils.js";
import type { ConfigLike, NetRoutePortConfigLike } from "./configHandler.js";
import { IPTablesCMD } from "./linuxUtils.js";


abstract class NetProxy {

    constructor(
        readonly proxyHost: string,
        readonly proxyPort: number,
        readonly targetHost: string,
        readonly targetPort: number
    ) {}

    abstract start(): void;
    abstract stop(): void;

}

export class TCPProxy extends NetProxy {
    
    protected readonly proxy: net.Server;

    constructor(
        proxyHost: string,
        proxyPort: number,
        targetHost: string,
        targetPort: number
    ) {
        super(proxyHost, proxyPort, targetHost, targetPort);

        this.proxy = net.createServer()
        
        this.proxy.on("connection", (clientSocket) => {
            console.log(`Client connected from ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);

            // Create connection to target server
            const targetSocket = net.createConnection(this.targetPort, this.targetHost);

            // Forward data from client to target
            clientSocket.pipe(targetSocket);
            // Forward data from target to client
            targetSocket.pipe(clientSocket);

            // Handle errors
            clientSocket.on("error", (err) => {
                targetSocket.end();
            });
            targetSocket.on("error", (err) => {
                targetSocket.end();
                clientSocket.end();
            });
            // Handle disconnection
            clientSocket.on("close", () => {
                targetSocket.end();
            });
            targetSocket.on("close", () => {
                clientSocket.end();
            });
        });
        this.proxy.on("error", (err) => {
            this.stop();
        });
    }

    public start() {
        this.proxy.listen(this.proxyPort, this.proxyHost, () => {
            console.log(`TCP-Proxy listening on ${this.proxyHost}:${this.proxyPort}`);
        });
    }

    public stop() {
        this.proxy.close();
    }
}


export class UDPProxy extends NetProxy {
    protected readonly proxy: dgram.Socket;
    protected readonly connections: Dict<dgram.Socket> = {};
    protected readonly timeout: number;

    constructor(
        proxyHost: string,
        proxyPort: number,
        targetHost: string,
        targetPort: number,
        timeout: number = 10000
    ) {
        super(proxyHost, proxyPort, targetHost, targetPort);
        this.proxy = dgram.createSocket("udp4");
        this.timeout = timeout;

        this.proxy.on("message", (msg: Uint8Array, sender) => {
            const senderKey = `${sender.address}:${sender.port}`;
            let client = this.connections[senderKey];
    
            if (!client) {

                client = dgram.createSocket("udp4");

                client.on("message", (response: Uint8Array) => {
                    this.proxy.send(response, sender.port, sender.address);
                });
                client.on("close", () => delete this.connections[senderKey]);
                client.on("error", (err) => client.close());
                
                this.connections[senderKey] = client;
            }
    
            client.send(msg, this.targetPort, this.targetHost, (err) => {
                if (err) {
                    client.close();
                }
            });
        });
        this.proxy.on("error", (err) => {
            this.stop();
        });
    }

    public start() {
        this.proxy.bind(this.proxyPort, this.proxyHost, () => {
            console.log(`UDP-Proxy listening on ${this.proxyHost}:${this.proxyPort}`);
        });
    }

    public stop() {
        for (const [key, client] of Object.entries(this.connections)) {
            client.close();
        }
        this.proxy.close();
    }
}


export class ProxyHandler {

    protected static proxies: NetProxy[] = [];

    static async start(config: ConfigLike) {
        await this.handle(true, config);
    }

    static async stop(config: ConfigLike) {
        await this.handle(false, config);

        for (const proxy of this.proxies) {
            proxy.stop();
        }
    }

    private static async handle(enable: boolean, config: ConfigLike) {
        subnet: for (const [subnetID, subnetConfig] of Object.entries(config.subnets)) {
            server: for (const [serverID, serverConfig] of Object.entries(subnetConfig.servers)) {
                if (!serverConfig.ports) continue server;
                for (const portConfig of serverConfig.ports) {
                    await this.handlePortConfig(enable, portConfig, subnetConfig.publicIP4, subnetID, serverID);
                }
            }
        }
    }

    private static async handlePortConfig(enable: boolean, portConfig: NetRoutePortConfigLike, publicIP4: string, subnetID: string, serverID: string) {

        let pubPortRange: string;
        if (typeof portConfig === "string" || typeof portConfig === "number") {
            pubPortRange = portConfig.toString().replace("-", ":");
        } else {
            pubPortRange = portConfig.pub.toString().replace("-", ":");
        }

        // Firewall rules
        IPTablesCMD.run(enable, `INPUT -p tcp -d ${publicIP4} --dport ${pubPortRange} -m conntrack --ctstate NEW,ESTABLISHED -j ACCEPT`);
        IPTablesCMD.run(enable, `OUTPUT -p tcp --sport ${pubPortRange} -m conntrack --ctstate ESTABLISHED -j ACCEPT`);
        
        const portMap: Array<
            { pub: number, local: number }
        > = [];

        if (typeof portConfig === "number") {
            portMap.push({ pub: portConfig, local: portConfig });
        } else if (typeof portConfig === "string") {
            const [startPort, endPort] = portConfig.split("-").map(Number);
            for (let port = startPort; port <= endPort; port++) {
                portMap.push({ pub: port, local: port });
            }
        } else {
            if (typeof portConfig.pub === "string" && typeof portConfig.local === "string") {

                const [pubStartPort, pubEndPort] = portConfig.pub.split("-").map(Number);
                const [localStartPort, localEndPort] = portConfig.local.split("-").map(Number);
                const listOfPubPorts = Array.from({ length: pubEndPort - pubStartPort + 1 }, (_, i) => i + pubStartPort);
                const listOfLocalPorts = Array.from({ length: localEndPort - localStartPort + 1 }, (_, i) => i + localStartPort);

                if (listOfPubPorts.length !== listOfLocalPorts.length) {
                    throw new Error("Number of public ports must match number of local ports");
                }

                for (let i = 0; i < listOfPubPorts.length; i++) {
                    portMap.push({ pub: listOfPubPorts[i], local: listOfLocalPorts[i] });
                }
            } else {
                const pubPort = typeof portConfig.pub === "string" ? Number(portConfig.pub) : portConfig.pub;
                const localPort = typeof portConfig.local === "string" ? Number(portConfig.local) : portConfig.local;
                portMap.push({ pub: pubPort, local: localPort });
            }
        }

        if (enable) {
            for (const { pub, local } of portMap) {
                try {
                    const tcpProxy = new TCPProxy(publicIP4, pub, `192.168.${subnetID}.${serverID}`, local);
                    const udpProxy = new UDPProxy(publicIP4, pub, `192.168.${subnetID}.${serverID}`, local);
                    tcpProxy.start();
                    udpProxy.start();
                } catch (err) {
                    console.error(`Failed to create proxy for ${publicIP4}:${pub} -> 192.168.${subnetID}.${serverID}:${local}`);
                }
            }
        }

    }

}