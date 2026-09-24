#!/usr/bin/env python3
"""Run a list of image generation jobs through gen_image.py with limited concurrency.

Usage:
  python3 tools/art/gen_batch.py tools/art/batches/<batch>.json [--workers 3]

The batch file is a JSON list of jobs, highest priority first:
  [{"name": "chars/wren_walk", "prompt_file": "tools/art/prompts/char_wren_walk.txt",
    "aspect": "portrait", "transparent": true}, ...]

Finished images are skipped by gen_image.py's own cache, so a batch can simply be re-run.
When Codex reports an exhausted usage limit, no further jobs are started.
Every result is appended as one JSON line to art_raw/_batch_log.jsonl.
"""
import argparse
import json
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOG = ROOT / 'art_raw' / '_batch_log.jsonl'
stop = threading.Event()
lock = threading.Lock()


def run_job(job):
    """Run one gen_image.py call and return its parsed JSON result."""
    if stop.is_set():
        return {'name': job['name'], 'ok': False, 'error': 'skipped: usage limit reached earlier'}
    cmd = [sys.executable, str(ROOT / 'tools/art/gen_image.py'), '--name', job['name'],
           '--prompt-file', str(ROOT / job['prompt_file'])]
    if job.get('transparent'):
        cmd.append('--transparent')
    if job.get('aspect'):
        cmd += ['--aspect', job['aspect']]
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    line = (proc.stdout.strip().splitlines() or ['{}'])[-1]
    try:
        res = json.loads(line)
    except ValueError:
        res = {'ok': False, 'error': 'unparseable result: ' + line[:200]}
    res['name'] = job['name']
    if not res.get('ok') and 'usage_limit' in str(res.get('error', '')):
        stop.set()
    with lock:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open('a') as fh:
            fh.write(json.dumps(res) + '\n')
        print(json.dumps(res), flush=True)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('batch')
    ap.add_argument('--workers', type=int, default=3)
    args = ap.parse_args()
    jobs = json.loads(Path(args.batch).read_text())
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(run_job, jobs))
    ok = sum(1 for r in results if r.get('ok'))
    print(f'batch done: {ok}/{len(results)} ok' + (' (stopped: usage limit)' if stop.is_set() else ''))
    sys.exit(0 if ok == len(results) else 1)


if __name__ == '__main__':
    main()
