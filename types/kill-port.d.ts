declare module "kill-port" {
  type KillPortProtocol = "tcp" | "udp" | "all"
  function killPort(port: number | string, protocol?: KillPortProtocol): Promise<void>
  export default killPort
}
