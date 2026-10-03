#!/usr/bin/env python3
"""
يحوّل ملفَّي أكسفورد الرسميين (PDF) إلى data/oxford5000.csv بالأعمدة word,level,pos.

  python3 scripts/oxford_pdf_to_csv.py "The_Oxford_3000_by_CEFR_level.pdf" "American_Oxford_5000.pdf"

- ملف 3000: الكلمات مجمّعة تحت عناوين المستويات (A1, A2, B1, B2).
- ملف 5000: المستوى بعد كل كلمة، وقد يختلف حسب النوع (alien n. B2, adj. C1).
يحتاج pdftotext (poppler-utils). الناتج لا يُرفع إلى git.
"""
import csv
import re
import subprocess
import sys
from pathlib import Path

POS = {
    'n.': 'noun', 'v.': 'verb', 'adj.': 'adjective', 'adv.': 'adverb', 'prep.': 'preposition',
    'conj.': 'conjunction', 'pron.': 'pronoun', 'det.': 'determiner', 'exclam.': 'exclamation',
    'modal v.': 'modal verb', 'auxiliary v.': 'auxiliary verb', 'number': 'number',
    'indefinite article': 'indefinite article', 'definite article': 'definite article',
    'infinitive marker': 'infinitive marker', 'ordinal number': 'ordinal number',
}
LEVELS = ('A1', 'A2', 'B1', 'B2', 'C1')
# الأطول أولًا حتى لا تبتلع "v." عبارة "modal v."
POS_RE = '|'.join(re.escape(p) for p in sorted(POS, key=len, reverse=True))
LEVEL_RE = '|'.join(LEVELS)
SEP = r'\s*[,/]\s*'  # الأنواع مفصولة بفاصلة أو شرطة مائلة: det./pron.
POS_LIST = rf'(?:{POS_RE})(?:{SEP}(?:{POS_RE}))*'
TAIL_3000 = re.compile(rf'^(?P<word>.+?)\s+(?P<pos>{POS_LIST})$')
GROUP_5000 = rf'{POS_LIST},?\s*(?:{LEVEL_RE})'  # يقبل "n.B2" و "adj., B2"
TAIL_5000 = re.compile(rf'^(?P<word>.+?)\s+(?P<rest>{GROUP_5000}(?:,\s*{GROUP_5000})*)$')
GROUP_PARSE = re.compile(rf'(?P<pos>{POS_LIST}),?\s*(?P<level>{LEVEL_RE})')
NOISE = re.compile(r'^(©.*|\d+\s*/\s*\d+|The Oxford .*|3000, it includes .*)$')


def text(pdf: str, tail: re.Pattern) -> list[str]:
    out = subprocess.run(['pdftotext', pdf, '-'], check=True, capture_output=True, text=True).stdout
    lines = [line.strip() for line in out.splitlines() if line.strip() and not NOISE.match(line.strip())]
    # دمج المداخل الملتفّة على سطرين: "light (from the sun/a lamp) n.," + "adj."
    merged: list[str] = []
    for line in lines:
        if merged and merged[-1] not in LEVELS and line not in LEVELS and not tail.match(merged[-1]) and tail.match(f'{merged[-1]} {line}'):
            merged[-1] = f'{merged[-1]} {line}'
        else:
            merged.append(line)
    return merged


def clean_word(word: str) -> str:
    word = re.sub(r'\s*\(.*?\)', '', word)  # "light (from the sun/a lamp)" ← light
    word = word.split(',')[0].strip()  # "a, an" ← a
    return re.sub(r'(?<=[a-z])\d+$', '', word)  # bow1 ← bow


def pos_names(pos: str) -> str:
    return ', '.join(POS[p.strip()] for p in re.findall(POS_RE, pos))


def parse_3000(lines, rows, skipped):
    level = None
    for line in lines:
        if line in LEVELS:
            level = line
            continue
        m = TAIL_3000.match(line)
        if level and m:
            rows.append((clean_word(m['word']), level, pos_names(m['pos'])))
        elif level:
            skipped.append(line)


def parse_5000(lines, rows, skipped):
    for line in lines:
        m = TAIL_5000.match(line)
        if not m:
            skipped.append(line)
            continue
        for g in GROUP_PARSE.finditer(m['rest']):
            rows.append((clean_word(m['word']), g['level'], pos_names(g['pos'])))


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    rows, skipped = [], []
    parse_3000(text(sys.argv[1], TAIL_3000), rows, skipped)
    parse_5000(text(sys.argv[2], TAIL_5000), rows, skipped)
    out = Path(__file__).resolve().parent.parent / 'data' / 'oxford5000.csv'
    with out.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['word', 'level', 'pos'])
        w.writerows(rows)
    counts = {lv: sum(1 for r in rows if r[1] == lv) for lv in LEVELS}
    print(f'{len(rows)} rows → {out}')
    print(counts)
    print(f'{len(skipped)} lines skipped:')
    for s in skipped:
        print('  ', s)


if __name__ == '__main__':
    main()
