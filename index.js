import * as core from "@actions/core";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { SfdxCommand } from "./classes/SfdxCommand.js";
import { ArgumentsWrapper } from "./classes/ArgumentsWrapper.js";

(async function start() {
  const SfdxArguments = new ArgumentsWrapper();
  if (SfdxArguments.username === undefined) return;
  await constructDestructiveChangesArgs(SfdxArguments);
  deploy(SfdxArguments);
})();

async function constructDestructiveChangesArgs(SfdxArguments) {
  if (!existsSync(SfdxArguments.pathToDestructiveChanges)) return;
  for (const file of await readdir(SfdxArguments.pathToDestructiveChanges)) {
    if (file === "destructiveChangesPost.xml") {
      SfdxArguments.destructiveChanges.push(
        "--postdestructivechanges",
        `${SfdxArguments.pathToDestructiveChanges}/destructiveChangesPost.xml`
      );
    } else if (file === "destructiveChangesPre.xml") {
      SfdxArguments.destructiveChanges.push(
        "--predestructivechanges",
        `${SfdxArguments.pathToDestructiveChanges}/destructiveChangesPre.xml`
      );
    }
  }
}

function deploy(SfdxArguments) {
  const GenerateManifestCommand = new SfdxCommand(
    [
      "force:source:manifest:create",
      "--sourcepath",
      SfdxArguments.pathToSalesforceProject,
      "--manifestname",
      "temp-deploy-manifest",
    ],
    "An error occured while trying to run force:source:manifest:create."
  );
  GenerateManifestCommand.run();
  if (!GenerateManifestCommand.succeeded) return;
  const deployArgs = [
    "force:source:deploy",
    "--manifest",
    "temp-deploy-manifest.xml",
    "--testlevel",
    SfdxArguments.testLevel,
    "--targetusername",
    SfdxArguments.username,
    "--verbose",
  ];
  if (SfdxArguments.destructiveChanges.length > 0)
    deployArgs.push(...SfdxArguments.destructiveChanges);
  if (SfdxArguments.timeout !== undefined)
    deployArgs.push("--wait", SfdxArguments.timeout);
  const DeployCommand = new SfdxCommand(
    deployArgs,
    "An error occured while trying to run force:source:deploy."
  );
  DeployCommand.run();
  if (DeployCommand.succeeded === true) core.setOutput("DEPLOYED", true);
}
