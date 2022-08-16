"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@oclif/core");
const addNodes = (tree, commandParts) => {
    const existingNode = tree.search(commandParts[0]);
    // If the node exists and there's another part, add it to the node
    if (existingNode && commandParts[1]) {
        addNodes(existingNode, commandParts.slice(1));
    }
    else {
        // The node doesn't exist, create it
        tree.insert(commandParts[0]);
        // If there are more parts, add them to the node
        if (commandParts.length > 1) {
            addNodes(tree.search(commandParts[0]), commandParts.slice(1));
        }
    }
};
const createCommandTree = (commands, topicSeparator = ':') => {
    const tree = core_1.CliUx.ux.tree();
    commands.forEach(command => {
        const commandParts = command.id.split(topicSeparator);
        addNodes(tree, commandParts);
    });
    return tree;
};
exports.default = createCommandTree;
