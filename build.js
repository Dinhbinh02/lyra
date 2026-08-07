const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function build() {
    console.log('Cleaning dist folder...');
    if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true, force: true });
    }
    fs.mkdirSync('dist');

    console.log('Copying static assets...');
    fs.copyFileSync('manifest.json', 'dist/manifest.json');
    fs.copyFileSync('miniplayer.html', 'dist/miniplayer.html');
    fs.copyFileSync('popup.html', 'dist/popup.html');
    fs.copyFileSync('bridge.js', 'dist/bridge.js');
    
    if (fs.existsSync('icons')) {
        copyDirSync('icons', 'dist/icons');
    }

    if (fs.existsSync('_locales')) {
        copyDirSync('_locales', 'dist/_locales');
    }

    console.log('Bundling & minifying JS/CSS files with esbuild...');
    try {
        await esbuild.build({
            entryPoints: [
                'background.js',
                'content.js',
                'bridge.js',
                'popup.js',
                'miniplayer.css',
                'popup.css'
            ],
            outdir: 'dist',
            bundle: true,
            minify: true,
            sourcemap: false,
            target: ['chrome100']
        });
        console.log('Build completed successfully!');

        console.log('Zipping dist folder...');
        if (fs.existsSync('lyra.zip')) {
            fs.unlinkSync('lyra.zip');
        }
        execSync('zip -r ../lyra.zip *', { cwd: 'dist' });
        console.log('Zip file "lyra.zip" created successfully at project root!');
    } catch (err) {
        console.error('Build failed:', err);
        process.exit(1);
    }
}

build();
