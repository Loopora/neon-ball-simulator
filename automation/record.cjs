const { chromium } = require('playwright');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, acceptDownloads: true });
    page.on('pageerror', e => console.error('Browser error:', e.message));
    await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
    const run = Number(process.env.GITHUB_RUN_NUMBER || 1);
    const variants = [
      { gravity: .18, speed: 9, rotation: 1.1, rings: 12, color: '#ffe348' },
      { gravity: .12, speed: 12, rotation: .6, rings: 14, color: '#ff4ad8' },
      { gravity: .24, speed: 10, rotation: 1.5, rings: 10, color: '#49baff' },
      { gravity: .08, speed: 14, rotation: .9, rings: 13, color: '#75ff8b' }
    ];
    const v = variants[(run - 1) % variants.length];
    await page.evaluate(v => {
      for (const id of ['gravity', 'speed', 'rotation', 'rings']) {
        const input = document.getElementById(id);
        input.value = v[id];
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector(`[data-color="${v.color}"]`).click();
    }, v);
    // Original recorder captures the canvas and the Web Audio destination together.
    const downloadPromise = page.waitForEvent('download', { timeout: 65000 });
    await page.locator('#record').click();
    await page.waitForTimeout(30000);
    await page.locator('#stoprecord').click();
    const download = await downloadPromise;
    await fs.mkdir('videos', { recursive: true });
    const input = 'videos/capture.webm';
    const output = `videos/neon-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
    await download.saveAs(input);
    const cmd = spawnSync('ffmpeg', [
      '-y', '-i', input, '-t', '30', '-vf', 'scale=540:960:flags=lanczos',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output
    ], { stdio: 'inherit' });
    if (cmd.status !== 0) throw new Error('FFmpeg conversion failed');
    await fs.unlink(input);
    console.log(`Created ${output} using ${JSON.stringify(v)}`);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
