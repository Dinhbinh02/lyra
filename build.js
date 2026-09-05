import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const baseCompilerOptions = {
    target: ['chrome110'],
    minify: true,
    treeShaking: true,
    legalComments: 'none',
    charset: 'utf8',
    sourcemap: false,
    drop: ['debugger'],
    pure: ['console.log', 'console.debug', 'console.info'],
    define: {
        'process.env.NODE_ENV': '"production"'
    }
};

function minifyHtml(htmlContent) {
    return htmlContent
        // Remove HTML comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Collapse whitespace between tags
        .replace(/>\s+</g, '><')
        // Collapse redundant multiple spaces/newlines
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function copyDirSync(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name === '.DS_Store') continue;

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function processHtmlFile(srcPath, destPath) {
    if (!fs.existsSync(srcPath)) return;
    const raw = fs.readFileSync(srcPath, 'utf8');
    const minified = minifyHtml(raw);
    fs.writeFileSync(destPath, minified, 'utf8');
}

async function build() {
    const startTime = Date.now();
    console.log('[Lyra Build] Cleaning and preparing dist folder...');
    if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true, force: true });
    }
    fs.mkdirSync('dist', { recursive: true });

    console.log('[Lyra Build] Copying & minifying static assets...');
    if (fs.existsSync('manifest.json')) fs.copyFileSync('manifest.json', 'dist/manifest.json');
    processHtmlFile('miniplayer.html', 'dist/miniplayer.html');
    processHtmlFile('popup.html', 'dist/popup.html');

    if (fs.existsSync('icons')) {
        copyDirSync('icons', 'dist/icons');
    }

    if (fs.existsSync('_locales')) {
        copyDirSync('_locales', 'dist/_locales');
    }

    console.log('[Lyra Build] Compiling JS & CSS in parallel with esbuild...');
    try {
        await Promise.all([
            // 1. Content & UI Scripts (Bundled as IIFE to isolate scope)
            esbuild.build({
                ...baseCompilerOptions,
                entryPoints: {
                    'content': 'src/index.js',
                    'miniplayer': 'miniplayer.js',
                    'popup': 'popup.js'
                },
                outdir: 'dist',
                bundle: true,
                format: 'iife'
            }),

            // 2. Background Service Worker (Bundled as ESM for MV3 module worker)
            esbuild.build({
                ...baseCompilerOptions,
                entryPoints: {
                    'background': 'background.js'
                },
                outdir: 'dist',
                bundle: true,
                format: 'esm'
            }),

            // 3. CSS Stylesheets
            esbuild.build({
                ...baseCompilerOptions,
                entryPoints: [
                    'miniplayer.css',
                    'popup.css'
                ],
                outdir: 'dist',
                bundle: true
            })
        ]);

        console.log('[Lyra Build] Packaging extension zip...');
        if (fs.existsSync('lyra.zip')) {
            fs.unlinkSync('lyra.zip');
        }
        try {
            execSync('zip -r ../lyra.zip *', { cwd: 'dist', stdio: 'ignore' });
            console.log('[Lyra Build] Zip package "lyra.zip" created successfully!');
        } catch (_) {
            try {
                execSync('powershell -Command "Compress-Archive -Path dist\\* -DestinationPath lyra.zip -Force"', { stdio: 'ignore' });
                console.log('[Lyra Build] Zip package "lyra.zip" created successfully!');
            } catch (zipErr) {
                console.warn('[Lyra Build] Could not create zip automatically:', zipErr.message);
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`[Lyra Build] Build completed successfully in ${elapsed}ms! All optimized files ready in dist/`);
    } catch (err) {
        console.error('[Lyra Build Error]', err);
        process.exit(1);
    }
}

build();

