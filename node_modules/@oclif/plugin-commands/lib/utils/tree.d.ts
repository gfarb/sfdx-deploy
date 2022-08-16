import { Interfaces } from '@oclif/core';
import { Tree } from '@oclif/core/lib/cli-ux/styled/tree';
declare const createCommandTree: (commands: Interfaces.Command[], topicSeparator?: string) => Tree;
export default createCommandTree;
