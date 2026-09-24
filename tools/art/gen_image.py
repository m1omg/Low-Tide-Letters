#!/usr/bin/env python3
"""Generate ONE raw image with the Codex CLI image tool (TECH_SPEC section 9) -> art_raw/<name>.png

CLI
  python3 tools/art/gen_image.py --name chars/mira_walk --prompt-file tools/art/prompts/mira_walk.txt
  python3 tools/art/gen_image.py --name rnd/boat --prompt "A cute hand-drawn paper boat ... Avoid: text."
      [--style-file <txt>]     text that is put in front of the prompt (the STYLE BLOCK of the bible)
      [--transparent]          appends the standard "fully transparent background" sentence
      [--aspect square|portrait|landscape]   appends an image format hint (1:1, 3:4, 4:3)
      [--force]                regenerate even if art_raw/<name>.png exists with an identical prompt
      [--timeout 600] [--retries 2] [--pause 20] [--effort low]

Behaviour
  * builds the instruction text (use the built-in image tool, exactly ONE image, copy the PNG, never draw
    with code, never read other directories or memories) and runs the codex companion from the project
    root with a 10 minute timeout,
  * the companion is told to write to a UNIQUE temporary file art_raw/_tmp/<unique>.png; this wrapper
    verifies that it opens as an image and only then moves it to art_raw/<name>.png, so a stale file can
    never be mistaken for a fresh result and 3 instances can run concurrently without sharing state,
  * retries up to 2 more times (20 s pause) on failure,
  * writes the final image prompt to art_raw/<name>.prompt.txt (provenance). If the PNG already exists and
    the stored prompt is identical the call is a cache hit (no generation) unless --force is given,
  * prints ONE line of JSON on stdout: {"ok","path","width","height","has_alpha","seconds","attempts","cached"}
    and exits 0 on success, 1 on failure. Progress and the companion log tail go to stderr.
  * when Codex answers that its usage limit / quota is exhausted the wrapper stops immediately (no
    retries), adds "usage_limit": true and the Codex message as "error" to the JSON and exits with code 2.

Import: from gen_image import generate_image
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

COMPANION = os.environ.get(
    'GEN_IMAGE_COMPANION',      # override only for tests (a stub that writes a PNG)
    '/home/mroz/.claude/plugins/cache/openai-codex/codex/1.0.5/scripts/codex-companion.mjs')

ASPECT_HINT = {
    'square': 'Image format: square, aspect ratio 1:1.',
    'portrait': 'Image format: portrait orientation, aspect ratio 3:4 (taller than wide).',
    'landscape': 'Image format: landscape orientation, aspect ratio 4:3 (wider than tall).',
}
TRANSPARENT_HINT = ('Background: fully transparent (PNG with a real alpha channel); nothing behind or under '
                    'the subject, no paper, no ground, no cast shadow.')


def build_prompt(prompt: str, style: str | None = None, transparent: bool = False, aspect: str | None = None) -> str:
    parts = []
    if style and style.strip():
        parts.append(style.strip())
    parts.append(prompt.strip())
    if transparent:
        parts.append(TRANSPARENT_HINT)
    if aspect:
        parts.append(ASPECT_HINT[aspect])
    return '\n\n'.join(parts).strip() + '\n'


def build_instruction(final_prompt: str, rel_target: str) -> str:
    return (
        'You are an image generation helper for this project. Do exactly the following and nothing else.\n'
        '1. Use your built-in image generation tool to generate exactly ONE image from the IMAGE PROMPT '
        'below. Pass the prompt as it is. Do NOT draw, render or compose the image with code (no Python, '
        'PIL, SVG, HTML, canvas or ImageMagick) and do not post-process, resize or convert the result.\n'
        f'2. Copy the generated PNG file to ./{rel_target} (create the folder if it is missing). Keep the '
        'original PNG bytes so that transparency is preserved.\n'
        '3. Do not read, list or search any other project directories or files, do not use memories, do not '
        'modify any other file, do not ask questions.\n'
        f'4. Finish with one line: SAVED ./{rel_target}   (or FAILED <reason>).\n\n'
        'IMAGE PROMPT:\n' + final_prompt.strip() + '\n')


def _inspect(path: Path):
    """Open + fully decode the image. Returns (w, h, has_alpha) or raises."""
    from PIL import Image
    import numpy as np
    with Image.open(path) as im:
        im.load()
        w, h = im.size
        has_alpha = False
        if im.mode in ('RGBA', 'LA') or 'transparency' in im.info:
            a = np.asarray(im.convert('RGBA'))[..., 3]
            has_alpha = bool((a < 16).mean() >= 0.01)
    if w < 64 or h < 64:
        raise ValueError(f'image too small: {w}x{h}')
    return w, h, has_alpha


def _run_companion(instruction: str, timeout: int, effort: str, log_path: Path) -> tuple[int, bool]:
    """Returns (returncode, timed_out). Output is written to log_path."""
    cmd = ['node', COMPANION, 'task', '--write', '--fresh', '--effort', effort, instruction]
    with open(log_path, 'wb') as logf:
        proc = subprocess.Popen(cmd, cwd=str(C.ROOT), stdout=logf, stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL, start_new_session=True)
        try:
            return proc.wait(timeout=timeout), False
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
                time.sleep(3)
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            except Exception:
                proc.kill()
            try:
                proc.wait(timeout=10)
            except Exception:
                pass
            return -9, True


def _quota_message(log_path: Path) -> str | None:
    """Codex reports an exhausted image / usage quota in its log. Retrying cannot help then."""
    try:
        text = log_path.read_text(encoding='utf-8', errors='replace')
    except Exception:
        return None
    for line in reversed(text.splitlines()):
        low = line.lower()
        if 'usage limit' in low or 'rate limit' in low or 'quota' in low:
            return line.replace('[codex]', '').strip()[:300]
    return None


def _tail(path: Path, n: int = 25) -> str:
    try:
        lines = path.read_text(encoding='utf-8', errors='replace').splitlines()
        return '\n'.join(lines[-n:])
    except Exception:
        return ''


def generate_image(name: str, prompt: str, style: str | None = None, transparent: bool = False,
                   aspect: str | None = None, force: bool = False, timeout: int = 600, retries: int = 2,
                   pause: int = 20, effort: str = 'low', log_dir: str | None = None) -> dict:
    """Generate art_raw/<name>.png. Returns the result dict that the CLI prints as JSON."""
    t0 = time.time()
    name = name.strip().lstrip('/').removesuffix('.png')
    if '..' in Path(name).parts:
        raise ValueError('--name must stay inside art_raw/')
    target = C.ART_RAW / f'{name}.png'
    prompt_file = C.ART_RAW / f'{name}.prompt.txt'
    final_prompt = build_prompt(prompt, style, transparent, aspect)
    result = dict(ok=False, path=C.rel(target), width=0, height=0, has_alpha=False, seconds=0.0,
                  attempts=0, cached=False)

    if not force and target.exists() and prompt_file.exists():
        try:
            if prompt_file.read_text(encoding='utf-8') == final_prompt:
                w, h, ha = _inspect(target)
                result.update(ok=True, width=w, height=h, has_alpha=ha, cached=True,
                              seconds=round(time.time() - t0, 1))
                C.log(f'[gen_image] {name}: cache hit (same prompt) - use --force to regenerate')
                return result
        except Exception:
            pass

    C.ensure_dir(target.parent)
    tmp_dir = C.ensure_dir(C.ART_RAW / '_tmp')
    logs = Path(log_dir) if log_dir else Path(tempfile.gettempdir()) / 'fable51_gen_logs'
    logs.mkdir(parents=True, exist_ok=True)
    safe = name.replace('/', '__')
    error = 'unknown'
    for attempt in range(1, retries + 2):
        result['attempts'] = attempt
        unique = f'gen_{safe}_{os.getpid()}_{uuid.uuid4().hex[:8]}'
        tmp_png = tmp_dir / f'{unique}.png'
        log_path = logs / f'{unique}.log'
        C.log(f'[gen_image] {name}: attempt {attempt}/{retries + 1} ...')
        ta = time.time()
        rc, timed_out = _run_companion(build_instruction(final_prompt, C.rel(tmp_png)), timeout, effort, log_path)
        dt = time.time() - ta
        if timed_out:
            error = f'timeout after {timeout}s'
        elif not tmp_png.exists():
            error = f'companion exit code {rc}, no image was written'
        else:
            try:
                w, h, ha = _inspect(tmp_png)
                shutil.move(str(tmp_png), str(target))
                w, h, ha = _inspect(target)          # final check on art_raw/<name>.png itself
                prompt_file.write_text(final_prompt, encoding='utf-8')
                result.update(ok=True, width=w, height=h, has_alpha=ha, seconds=round(time.time() - t0, 1))
                C.log(f'[gen_image] {name}: ok {w}x{h} alpha={ha} in {dt:.0f}s')
                try:
                    log_path.unlink()
                except OSError:
                    pass
                break
            except Exception as e:      # not an image / truncated
                error = f'bad image: {e}'
        C.log(f'[gen_image] {name}: attempt {attempt} failed after {dt:.0f}s: {error}')
        tail = _tail(log_path)
        if tail:
            C.log('  --- companion log tail (' + str(log_path) + ') ---\n  ' + tail.replace('\n', '\n  '))
        try:
            if tmp_png.exists():
                tmp_png.unlink()
        except OSError:
            pass
        quota = _quota_message(log_path)
        if quota:
            error = 'usage_limit: ' + quota
            result['usage_limit'] = True
            C.log(f'[gen_image] {name}: the Codex usage limit is exhausted - not retrying')
            break
        if attempt <= retries:
            time.sleep(pause)
    if not result['ok']:
        result['error'] = error
        result['seconds'] = round(time.time() - t0, 1)
    try:                                 # remove the temp dir when it is empty (ignore races)
        tmp_dir.rmdir()
    except OSError:
        pass
    return result


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--name', required=True, help='relative name below art_raw/ without extension, e.g. chars/mira_walk')
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--prompt-file', help='text file with the image prompt')
    g.add_argument('--prompt', help='the image prompt itself')
    ap.add_argument('--style-file', default=None)
    ap.add_argument('--transparent', action='store_true')
    ap.add_argument('--aspect', choices=sorted(ASPECT_HINT), default=None)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--timeout', type=int, default=600)
    ap.add_argument('--retries', type=int, default=2)
    ap.add_argument('--pause', type=int, default=20)
    ap.add_argument('--effort', default='low')
    ap.add_argument('--log-dir', default=None)
    args = ap.parse_args(argv)
    prompt = args.prompt if args.prompt is not None else C.resolve(args.prompt_file).read_text(encoding='utf-8')
    style = C.resolve(args.style_file).read_text(encoding='utf-8') if args.style_file else None
    if not prompt.strip():
        ap.error('empty prompt')
    res = generate_image(args.name, prompt, style=style, transparent=args.transparent, aspect=args.aspect,
                         force=args.force, timeout=args.timeout, retries=args.retries, pause=args.pause,
                         effort=args.effort, log_dir=args.log_dir)
    print(json.dumps(res), flush=True)
    if res['ok']:
        return 0
    return 2 if res.get('usage_limit') else 1


if __name__ == '__main__':
    sys.exit(main())
