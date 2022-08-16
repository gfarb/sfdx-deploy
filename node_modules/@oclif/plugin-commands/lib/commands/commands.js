"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@oclif/core");
const _ = require("lodash");
const os_1 = require("os");
const tree_1 = require("../utils/tree");
class Commands extends core_1.Command {
    async run() {
        const { flags } = await this.parse(Commands);
        let commands = this.getCommands();
        if (!flags.hidden) {
            commands = commands.filter(c => !c.hidden);
        }
        const config = this.config;
        commands = _.sortBy(commands, 'id').map(command => {
            // Template supported fields.
            command.description = (typeof command.description === 'string' && _.template(command.description)({ command, config })) || undefined;
            command.summary = (typeof command.summary === 'string' && _.template(command.summary)({ command, config })) || undefined;
            command.usage = (typeof command.usage === 'string' && _.template(command.usage)({ command, config })) || undefined;
            command.id = (0, core_1.toConfiguredId)(command.id, this.config);
            return command;
        });
        if (this.jsonEnabled() && !flags.tree) {
            const formatted = await Promise.all(commands.map(async (cmd) => {
                let commandClass = await cmd.load();
                const obj = Object.assign(Object.assign({}, cmd), commandClass);
                // Load all properties on all extending classes.
                while (commandClass !== undefined) {
                    commandClass = Object.getPrototypeOf(commandClass) || undefined;
                    Object.assign(obj, commandClass);
                }
                // The plugin property on the loaded class contains a LOT of information including all the commands again. Remove it.
                delete obj.plugin;
                // If Command classes have circular references, don't break the commands command.
                return this.removeCycles(obj);
            }));
            return formatted;
        }
        if (flags.tree) {
            const tree = (0, tree_1.default)(commands, this.config.topicSeparator);
            if (!this.jsonEnabled()) {
                tree.display();
            }
            return tree;
        }
        core_1.CliUx.ux.table(commands.map(command => {
            // Massage some fields so it looks good in the table
            command.description = (command.description || '').split(os_1.EOL)[0];
            command.summary = (command.summary || (command.description || '').split(os_1.EOL)[0]);
            command.hidden = Boolean(command.hidden);
            command.usage = (command.usage || '');
            return command;
        }), {
            id: {
                header: 'Command',
            },
            summary: {},
            description: {
                extended: true,
            },
            usage: {
                extended: true,
            },
            pluginName: {
                extended: true,
                header: 'Plugin',
            },
            pluginType: {
                extended: true,
                header: 'Type',
            },
            hidden: {
                extended: true,
            },
        }, Object.assign({}, flags));
    }
    getCommands() {
        return this.config.commands;
    }
    removeCycles(object) {
        // Keep track of seen objects.
        const seenObjects = new WeakMap();
        const _removeCycles = (obj) => {
            // Use object prototype to get around type and null checks
            if (Object.prototype.toString.call(obj) === '[object Object]') {
                // We know it is a "Dictionary" because of the conditional
                const dictionary = obj;
                if (seenObjects.has(dictionary)) {
                    // Seen, return undefined to remove.
                    return undefined;
                }
                seenObjects.set(dictionary, undefined);
                for (const key in dictionary) {
                    // Delete the duplicate object if cycle found.
                    if (_removeCycles(dictionary[key]) === undefined) {
                        delete dictionary[key];
                    }
                }
            }
            else if (Array.isArray(obj)) {
                for (const i in obj) {
                    if (_removeCycles(obj[i]) === undefined) {
                        // We don't want to delete the array, but we can replace the element with null.
                        obj[i] = null;
                    }
                }
            }
            return obj;
        };
        return _removeCycles(object);
    }
}
exports.default = Commands;
Commands.description = 'list all the commands';
Commands.enableJsonFlag = true;
Commands.flags = Object.assign({ help: core_1.Flags.help({ char: 'h' }), hidden: core_1.Flags.boolean({ description: 'show hidden commands' }), tree: core_1.Flags.boolean({ description: 'show tree of commands' }) }, core_1.CliUx.ux.table.flags());
