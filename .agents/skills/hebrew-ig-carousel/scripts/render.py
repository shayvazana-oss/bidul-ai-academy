"""Render a carousel HTML deck to 1080x1350 PNGs with headless Chrome.

usage: python3 render.py <deck.html> <out_dir> [name1,name2,...]

Copies the skill's brand icons next to the deck, counts slides from `S.push(`, screenshots the page once,
crops one PNG per slide and writes contact.jpg (all slides on one sheet) to out_dir.
Needs: Python 3 + Pillow (`pip install pillow`), Google Chrome / Chromium / Edge, and internet
(Google Fonts and the lucide icon CDN). Set CHROME=/path/to/chrome to override the browser lookup.
"""
import os, sys, shutil, subprocess
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is missing. Run: pip install pillow')

CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    '/opt/pw-browsers/chromium',  # Playwright's Chromium in Claude Code cloud sessions
]

def chrome_flags():
    # Chrome refuses to start as root (Docker, cloud sessions) without --no-sandbox.
    flags = ['--headless=new', '--disable-gpu', '--hide-scrollbars']
    if hasattr(os, 'geteuid') and os.geteuid() == 0:
        flags.append('--no-sandbox')
    flags += os.environ.get('CHROME_FLAGS', '').split()
    return flags

def find_chrome():
    if os.environ.get('CHROME'):
        return os.environ['CHROME']
    for c in CANDIDATES:
        if Path(c).exists():
            return c
    for name in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'msedge'):
        p = shutil.which(name)
        if p:
            return p
    sys.exit('Chrome not found. Install Google Chrome, or set CHROME=/path/to/chrome')

def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    skill = Path(__file__).resolve().parents[1]
    deck = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[2]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    icons = deck.parent / 'icons'
    icons.mkdir(exist_ok=True)
    for f in (skill / 'assets/icons').glob('*.svg'):
        if not (icons / f.name).exists():
            shutil.copy(f, icons / f.name)
    n = deck.read_text(encoding='utf-8').count('S.push(')
    names = sys.argv[3].split(',') if len(sys.argv) > 3 else [f'{i + 1:02d}' for i in range(n)]
    if len(names) != n:
        sys.exit(f'{n} slides in the deck but {len(names)} names given')
    shot = out / '_all.png'
    subprocess.run([find_chrome(), *chrome_flags(),
                    '--allow-file-access-from-files', '--virtual-time-budget=15000',
                    f'--window-size=1080,{n * 1350}', f'--screenshot={shot}', deck.as_uri()],
                   check=True, stderr=subprocess.DEVNULL)
    im = Image.open(shot).convert('RGB')
    cols = min(4, n)
    rows = (n + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 432, rows * 540), 'white')
    for i, name in enumerate(names):
        s = im.crop((0, i * 1350, 1080, (i + 1) * 1350))
        s.save(out / f'{name}.png')
        sheet.paste(s.resize((432, 540)), ((i % cols) * 432, (i // cols) * 540))
    sheet.save(out / 'contact.jpg')
    shot.unlink()
    print(f'{n} slides -> {out}')

if __name__ == '__main__':
    main()
