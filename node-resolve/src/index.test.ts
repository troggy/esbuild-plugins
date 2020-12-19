import { build } from 'esbuild'
import { writeFiles } from 'test-support'
import NodeResolvePlugin from '.'
import slash from 'slash'
import path from 'path'

require('debug').enable(require('../package.json').name)

test('works', async () => {
    const {
        unlink,
        base,
        paths: [ENTRY],
    } = await writeFiles({
        'entry.ts': `import {x} from './utils'; console.log(x);`,
        'utils.ts': `import mod from 'mod'; export const x = mod('x');`,
        'node_modules/mod/index.js': 'export default () => {}',
    })
    let called = 0
    let resolved: string[] = []
    const res = await build({
        entryPoints: [ENTRY],
        write: false,
        format: 'esm',
        target: 'es2017',
        bundle: true,
        plugins: [
            NodeResolvePlugin({
                extensions: ['.js', '.ts'],
                onUnresolved: (e) => {
                    throw e
                },
                onResolved: (x) => {
                    resolved.push(x)
                    called++
                    return x
                },
            }),
        ],
    })
    expect(called).toBe(3)
    const expected = ['entry.ts', 'utils.ts', 'node_modules/mod/index.js']
    expect(resolved.map(normalize(base))).toEqual(expected)
    unlink()
})

test('does not throw when onUnresolved', async () => {
    const {
        unlink,
        paths: [ENTRY],
    } = await writeFiles({
        'entry.ts': `import {x} from 'xxx'; console.log(x);`,
    })
    let called = false

    await build({
        entryPoints: [ENTRY],
        write: false,
        bundle: true,
        plugins: [
            NodeResolvePlugin({
                extensions: ['.js', '.ts'],
                onUnresolved: () => {
                    called = true
                    return {
                        external: true,
                    }
                },
            }),
        ],
    })
    expect(called).toBeTruthy()
    unlink()
})

test('uses mainFields option', async () => {
    const {
        unlink,
        base,
        paths: [ENTRY],
    } = await writeFiles({
        'main.ts': `import mod from 'mod'; export const x = mod('x');`,
        'node_modules/mod/module.js': 'export default () => {}',
        'node_modules/mod/package.json': JSON.stringify({
            name: 'mod',
            version: '0.0.0',
            module: 'module.js',
            main: 'module.js',
        }),
    })
    let resolved: string[] = []

    await build({
        entryPoints: [ENTRY],
        write: false,
        bundle: true,
        plugins: [
            NodeResolvePlugin({
                extensions: ['.js', '.ts', '.json'],
                mainFields: ['module', 'main'],
                onUnresolved: (e) => {
                    throw e
                },
                onResolved(p) {
                    resolved.push(p)
                },
            }),
        ],
    })
    expect(resolved.map(normalize(base))).toEqual([
        'main.ts',
        'node_modules/mod/module.js',
    ])
    unlink()
})

const normalize = (base) => (x) => slash(path.relative(base, x))
