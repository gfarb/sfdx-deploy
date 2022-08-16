import { Command } from '@oclif/core';
export default class Commands extends Command {
    static description: string;
    static enableJsonFlag: boolean;
    static flags: any;
    run(): Promise<unknown[] | import("@oclif/core/lib/cli-ux/styled/tree").Tree | undefined>;
    private getCommands;
    private removeCycles;
}
