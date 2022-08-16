"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wait = exports.rm = exports.ls = exports.touch = void 0;
const tslib_1 = require("tslib");
const fs = (0, tslib_1.__importStar)(require("fs-extra"));
const path = (0, tslib_1.__importStar)(require("path"));
async function touch(p) {
    try {
        await fs.utimes(p, new Date(), new Date());
    }
    catch (_a) {
        await fs.outputFile(p, '');
    }
}
exports.touch = touch;
async function ls(dir) {
    const files = await fs.readdir(dir);
    const paths = files.map(f => path.join(dir, f));
    return Promise.all(paths.map(path => fs.stat(path).then(stat => ({ path, stat }))));
}
exports.ls = ls;
async function rm(dir) {
    return new Promise(resolve => {
        fs.rm(dir, { recursive: true, force: true }, () => {
            resolve();
        });
    });
}
exports.rm = rm;
function wait(ms, unref = false) {
    return new Promise(resolve => {
        const t = setTimeout(() => resolve(), ms);
        if (unref)
            t.unref();
    });
}
exports.wait = wait;
