import * as core from "@actions/core";
import { spawnSync } from "node:child_process";
export class SfdxCommand {
  command = "sfdx";
  constructor(commandArgs, errorMessage) {
    this.commandArgs = commandArgs;
    this.errorMessage = errorMessage;
  }
  run() {
    try {
      const results = spawnSync(this.command, this.commandArgs, {
        stdio: "inherit",
      });
      this.succeeded = results.status === 0 ? true : false;
      if (!this.succeeded) {
        core.setFailed(this.errorMessage);
      }
    } catch (err) {
      core.setFailed(this.errorMessage);
    }
  }
}
