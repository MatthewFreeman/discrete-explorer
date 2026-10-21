'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Code points keep restricted labels out of the publication policy itself.
const words = [
    [99, 111, 100, 101, 120],
    [1082, 1086, 1076, 1077, 1082, 1089],
].map(points => String.fromCodePoint(...points));
const providers = [[111, 112, 101, 110, 97, 105], [99, 104, 97, 116, 103, 112, 116]]
    .map(points => String.fromCodePoint(...points));
const restricted = new RegExp(words.join('|'), 'ig');
const creditedProvider = new RegExp(`\\b(?:generated|authored|written|created|assisted)\\s+(?:by|with|using)\\s+(?:${providers.join('|')})\\b`, 'i');
const localPath = /\b[a-z]:[\\/][a-z0-9_. -]{2,}[\\/]|\/(?:Users|home)\/[^/\s]+\//i;
const trailers = /^(?:co-authored-by|author|generated-by):/im;
const guidance = /(?:^|\/)(?:AGENTS(?:\.[^/]*)?\.md|SKILL\.md)$/i;
const zero = /^0+$/;

function git(args, input) {
    return execFileSync('git', args, { input, maxBuffer: 128 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}

function safe(value) {
    return value.replace(restricted, '[restricted]').replace(/[\r\n]/g, ' ');
}

function checkText(value, label, violations) {
    restricted.lastIndex = 0;
    if (restricted.test(value)) violations.push(`Restricted label in ${safe(label)}`);
    if (creditedProvider.test(value)) violations.push(`Generated attribution in ${safe(label)}`);
    if (localPath.test(value)) violations.push(`Local filesystem path in ${safe(label)}`);
    if (trailers.test(value)) violations.push(`Attribution trailer in ${safe(label)}`);
}

function checkRef(ref, label, violations) {
    checkText(label, 'reference name', violations);
    let object = git(['rev-parse', '--verify', '--end-of-options', ref]).toString().trim();
    const seen = new Set();
    while (git(['cat-file', '-t', object]).toString().trim() === 'tag') {
        if (seen.has(object)) throw new Error('Cyclic tag reference');
        seen.add(object);
        const tag = git(['cat-file', 'tag', object]).toString('utf8');
        checkText(tag, 'annotated tag metadata', violations);
        const target = /^object ([a-f0-9]{40,64})$/m.exec(tag);
        if (!target) throw new Error('Invalid tag object');
        object = target[1];
    }
    const sha = git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).toString().trim();
    const entries = git(['ls-tree', '-rz', sha]).toString('utf8').split('\0').filter(Boolean).map(record => {
        const tab = record.indexOf('\t');
        const [mode, type, oid] = record.slice(0, tab).split(' ');
        return { mode, type, oid, name: record.slice(tab + 1) };
    });
    for (const entry of entries) {
        checkText(entry.name, 'tracked filename', violations);
        if (guidance.test(entry.name)) violations.push(`Local guidance file: ${safe(entry.name)}`);
    }
    const blobs = entries.filter(entry => entry.type === 'blob');
    const batch = git(['cat-file', '--batch'], blobs.map(entry => entry.oid + '\n').join(''));
    let offset = 0;
    for (const entry of blobs) {
        const end = batch.indexOf(10, offset);
        if (end < 0) throw new Error('Incomplete object stream');
        const [oid, type, sizeText] = batch.subarray(offset, end).toString().split(' ');
        const size = Number(sizeText);
        if (oid !== entry.oid || type !== 'blob' || !Number.isSafeInteger(size) || size < 0 || end + size + 1 >= batch.length) {
            throw new Error('Invalid object stream');
        }
        const content = batch.subarray(end + 1, end + 1 + size);
        checkText(content.toString('utf8'), `tracked file ${entry.name}`, violations);
        if (content[0] === 0xff && content[1] === 0xfe) {
            checkText(content.toString('utf16le'), `tracked file ${entry.name}`, violations);
        } else if (content[0] === 0xfe && content[1] === 0xff && content.length % 2 === 0) {
            checkText(Buffer.from(content).swap16().toString('utf16le'), `tracked file ${entry.name}`, violations);
        }
        offset = end + 1 + size + 1;
    }
    const metadata = git(['log', '--format=%H%n%an <%ae>%n%cn <%ce>%n%B', sha]).toString('utf8');
    checkText(metadata, 'reachable commit metadata', violations);
}

function installHook() {
    let configured;
    try { configured = git(['config', '--get', 'core.hooksPath']).toString().trim(); } catch (error) {
        if (error.status !== 1) throw error;
    }
    if (configured) throw new Error('A custom hook directory is configured; install the publication check there explicitly');
    const common = path.resolve(git(['rev-parse', '--git-common-dir']).toString().trim());
    const directory = path.join(common, 'hooks');
    const hook = path.join(directory, 'pre-push');
    const source = '#!/bin/sh\nexec node "$(dirname "$0")/publication-check.cjs" --pre-push "$@"\n';
    if (fs.existsSync(hook) && fs.readFileSync(hook, 'utf8') !== source) {
        throw new Error('An existing pre-push hook must be preserved; chain the publication check explicitly');
    }
    fs.mkdirSync(directory, { recursive: true });
    fs.copyFileSync(__filename, path.join(directory, 'publication-check.cjs'));
    fs.writeFileSync(hook, source, { mode: 0o755 });
    fs.chmodSync(hook, 0o755);
    console.log('Publication pre-push check installed for this repository and its worktrees.');
}

function main(args) {
    if (args[0] === '--install-hook') return installHook();
    const violations = [];
    if (args[0] === '--pre-push') {
        for (const line of fs.readFileSync(0, 'utf8').trim().split('\n').filter(Boolean)) {
            const fields = line.trim().split(/\s+/);
            if (fields.length !== 4 || !/^[a-f0-9]{40,64}$/.test(fields[1]) || !/^[a-f0-9]{40,64}$/.test(fields[3])) {
                throw new Error('Invalid pre-push input');
            }
            const [localRef, localSha, remoteRef] = fields;
            if (zero.test(localSha)) continue;
            checkText(localRef, 'local reference name', violations);
            checkRef(localSha, remoteRef, violations);
        }
    } else {
        if (args.length && (args[0] !== '--ref' || args.length !== 2)) throw new Error('Use --ref REVISION, --pre-push, or --install-hook');
        let branch = process.env.PUBLICATION_REF || '';
        if (!branch) {
            try { branch = git(['symbolic-ref', '--short', '-q', 'HEAD']).toString().trim(); } catch (error) {
                if (error.status !== 1) throw error;
            }
        }
        checkRef(args[1] || 'HEAD', branch, violations);
        checkText(process.env.PUBLICATION_TITLE || '', 'pull request title', violations);
        checkText(process.env.PUBLICATION_BODY || '', 'pull request body', violations);
    }
    const unique = [...new Set(violations)];
    if (unique.length) {
        for (const violation of unique) console.error(violation);
        process.exitCode = 1;
    } else console.log('Publication check passed: tracked content, names, and reachable commit metadata.');
}

if (require.main === module) {
    try { main(process.argv.slice(2)); } catch {
        console.error('Publication check could not complete. Verify the Git objects and command inputs.');
        process.exitCode = 1;
    }
}

module.exports = { main };
