import {
  getStatus,
  listPackages,
  openShizuku,
  requestPermission,
  runAdbCommand,
  type ListPackagesRequest,
  type RunAdbCommandResponse,
  type ShizukuStatus,
} from "tauri-plugin-shizuku-api";

export class Shizuku {
  async getStatus(): Promise<ShizukuStatus> {
    try {
      return await getStatus();
    } catch (e) {
      throw Error(`Error when reading Shizuku status: ${e}`);
    }
  }

  /** asks Shizuku for permission; true when it was granted */
  async requestPermission(): Promise<boolean> {
    try {
      return (await requestPermission()).granted;
    } catch (e) {
      throw Error(`Error when requesting Shizuku permission: ${e}`);
    }
  }

  async openShizuku() {
    try {
      await openShizuku();
    } catch (e) {
      throw Error(`Error when opening Shizuku: ${e}`);
    }
  }

  async executeAdb(command: string, timeout = 15000): Promise<RunAdbCommandResponse> {
    try {
      return await runAdbCommand({ command, timeoutMs: timeout });
    } catch (e) {
      throw Error(`Error when executing ADB command through Shizuku: ${e}`);
    }
  }

  async listPackages(payload?: ListPackagesRequest): Promise<string[]> {
    try {
      return (await listPackages(payload)).packages;
    } catch (e) {
      throw Error(`Error when listing packages through Shizuku: ${e}`);
    }
  }
}
