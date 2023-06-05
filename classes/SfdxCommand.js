import * as core from "@actions/core";
import { spawnSync } from "node:child_process";
export class SfdxCommand {
  constructor(commandArgs, errorMessage) {
    this.commandArgs = ["sfdx-cli", ...commandArgs];
    this.errorMessage = errorMessage;
  }
  run() {
    try {
      const results = spawnSync("npx", this.commandArgs, {
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
