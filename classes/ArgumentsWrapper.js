import * as core from "@actions/core";
export class ArgumentsWrapper {
  constructor() {
    if (process.env.TARGET_USERNAME === undefined) {
      core.setFailed("TARGET_USERNAME is not defined");
      return;
    }
    this.username = process.env.TARGET_USERNAME;
    this.pathToSalesforceProject =
      process.env.SOURCE_PATH !== undefined
        ? `${process.cwd()}/${process.env.SOURCE_PATH}`
        : process.cwd() + "/force-app";
    this.pathToDestructiveChanges =
      process.env.DESTRUCTIVE_CHANGES !== undefined
        ? `${process.cwd()}/${process.env.DESTRUCTIVE_CHANGES}`
        : `${process.cwd()}/destructive-changes`;
    this.testLevel =
      process.env.TEST_LEVEL !== undefined
        ? process.env.TEST_LEVEL
        : "RunLocalTests";
    this.timeout =
      process.env.WAIT !== undefined ? process.env.WAIT : undefined;
    this.destructiveChanges = [];
  }
}
