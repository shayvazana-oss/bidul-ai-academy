#!/usr/bin/env python3
"""Review wording and optionally preview plain punctuation.

Default output preserves the draft. Suggestions need editorial judgment.
The historical filename is retained for /li-human workflows.
"""
import argparse
import json
from pathlib import Path
import re
import sys

LEX = Path(__file__).with_name("slop.json")
URL_RE = re.compile(r"https?://\S+|www\.\S+|\S+@\S+\.\S+")
# Only visible punctuation, never format characters or mathematical symbols.
PLAIN_PUNCTUATION = {
    "\u2014": ", ", "\u2013": "-", "\u2018": "'", "\u2019": "'",
    "\u201c": '"', "\u201d": '"', "\u2026": "...",
}


def load_lexicon(path=LEX):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def split_links(text):
    """Yield (content, is_link) without placeholders that could collide."""
    end = 0
    for match in URL_RE.finditer(text):
        yield text[end:match.start()], False
        yield match.group(), True
        end = match.end()
    yield text[end:], False


def plain_punctuation(text):
    changes = []
    for char, replacement in PLAIN_PUNCTUATION.items():
        count = text.count(char)
        if not count:
            continue
        changes.append({"from": char, "to": replacement, "count": count})
        if char == "\u2014":
            text = re.sub(r"[ \t]*\u2014[ \t]*", replacement, text)
        else:
            text = text.replace(char, replacement)
    return text, changes


def wording_suggestions(text, lex):
    suggestions, occupied = [], []
    entries = sorted(lex["phrases"] + lex["words"],
                     key=lambda entry: len(entry["find"]), reverse=True)
    for entry in entries:
        pattern = re.compile(r"\b" + re.escape(entry["find"]).replace(r"\ ", r"[ \t]+")
                             + r"\b", re.IGNORECASE)
        matches = [match for match in pattern.finditer(text)
                   if not any(match.start() < end and match.end() > start
                              for start, end in occupied)]
        if matches:
            occupied.extend(match.span() for match in matches)
            suggestions.append({"find": entry["find"], "suggestion": entry["replace"],
                                "count": len(matches)})
    return suggestions


def scan_structures(text, lex):
    notes = []
    for entry in lex["structures"]:
        count = len(re.findall(entry["regex"], text, re.MULTILINE))
        if count:
            notes.append({"name": entry["name"], "count": count,
                          "suggestion": entry["fix"]})
    return notes


def humanize(text, lex, *, plain_typography=False):
    """Return a draft preview and editing notes, without scoring."""
    output, review_parts, changes = [], [], []
    for part, is_link in split_links(text):
        review_parts.append(" " * len(part) if is_link else part)
        if plain_typography and not is_link:
            part, part_changes = plain_punctuation(part)
            changes.extend(part_changes)
        output.append(part)
    review_text = "".join(review_parts)
    return "".join(output), {
        "typographic": changes,
        "wording": wording_suggestions(review_text, lex),
        "structures": scan_structures(review_text, lex),
    }


def render_report(report, out=sys.stderr):
    print("VOICE EDIT REVIEW", file=out)
    print("Suggestions are optional. Check meaning and the user's voice before editing.", file=out)
    for item in report["typographic"]:
        print(f"  Punctuation: {item['from']!r} -> {item['to']!r} ({item['count']}x)", file=out)
    for item in report["wording"]:
        option = repr(item["suggestion"]) if item["suggestion"] else "omit if redundant"
        print(f"  Wording: {item['find']!r} -> consider {option} ({item['count']}x)", file=out)
    for item in report["structures"]:
        print(f"  Structure: {item['name']} ({item['count']}x): {item['suggestion']}", file=out)
    if not any(report.values()):
        print("  No editing suggestions from this lexicon.", file=out)


def main():
    ap = argparse.ArgumentParser(description="Review wording and optionally preview plain punctuation.")
    ap.add_argument("input", nargs="?", default="-", help="UTF-8 file, or - for stdin")
    ap.add_argument("-o", "--out", help="write the preview to a new, separate file")
    ap.add_argument("--report", action="store_true", help="print editing notes to stderr")
    ap.add_argument("--json", action="store_true", help="emit {text, report} as JSON")
    ap.add_argument("--lexicon", default=LEX, help="path to a user-selected wording lexicon")
    ap.add_argument("--plain-typography", action="store_true",
                    help="preview plain punctuation; review the resulting sentence boundaries")
    args = ap.parse_args()
    if args.out and args.input != "-" and Path(args.out).resolve() == Path(args.input).resolve():
        ap.error("use a separate output file so the original draft is preserved")
    if args.json and args.out:
        ap.error("choose --json or --out, not both")
    if args.input == "-":
        raw = sys.stdin.read()
    else:
        with open(args.input, encoding="utf-8", newline="") as fh:
            raw = fh.read()
    preview, report = humanize(raw, load_lexicon(args.lexicon),
                               plain_typography=args.plain_typography)
    if args.json:
        print(json.dumps({"text": preview, "report": report}, indent=2, ensure_ascii=False))
    elif args.out:
        # Exclusive creation also rejects aliases/hard links to the source.
        with open(args.out, "x", encoding="utf-8", newline="") as fh:
            fh.write(preview)
    else:
        sys.stdout.write(preview)
    if args.report:
        render_report(report)


if __name__ == "__main__":
    main()