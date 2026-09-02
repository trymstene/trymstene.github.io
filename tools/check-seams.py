# -*- coding: utf-8 -*-
# SEAM CHECK, per FUNCTION — every free identifier a lazy chunk uses must be
# in its init destructure (= a getter on phoneCtx in main). Scope-aware to the
# top-level function: a `const cap` inside renderBuy must not hide the free
# `cap()` inside shedRows (that exact miss broke the shed's "place it").
import io, re, sys


def strip_code(src):
    src = re.sub(r'/\*.*?\*/', ' ', src, flags=re.S)
    src = re.sub(r'//[^\n]*', ' ', src)
    src = re.sub(r"'(?:\\.|[^'\\\n])*'", "''", src)
    src = re.sub(r'"(?:\\.|[^"\\\n])*"', '""', src)
    src = re.sub(r'`(?:\\.|[^`\\])*`', '``', src)
    return src


def locals_of(code):
    local = set(re.findall(r'\b(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)', code))
    for stmt in re.findall(r'\b(?:const|let|var)\s+([^;\n]*)', code):
        for part in stmt.split(','):
            m = re.match(r'^\s*([A-Za-z_$][\w$]*)\s*=', part)
            if m: local.add(m.group(1))
    for grp in re.findall(r'\bfunction\s*[\w$]*\s*\(([^)]*)\)', code):
        for p in grp.split(','):
            p = p.strip().split('=')[0].strip()
            if re.match(r'^[A-Za-z_$][\w$]*$', p): local.add(p)
    for grp in re.findall(r'\(([^()]*)\)\s*=>', code):
        for p in grp.replace('[', ',').replace(']', ',').replace('{', ',').replace('}', ',').split(','):   # ([k, n]) => and ({ a, b }) =>
            p = p.strip().split('=')[0].strip().split(':')[-1].strip()
            if re.match(r'^[A-Za-z_$][\w$]*$', p): local.add(p)
    for m2 in re.findall(r'(?<![\w$])([A-Za-z_$][\w$]*)\s*=>', code): local.add(m2)
    for m2 in re.findall(r'\bcatch\s*\(\s*([\w$]+)\s*\)', code): local.add(m2)
    for grp in re.findall(r'(?:const|let|var)\s*\{([^}]*)\}', code):
        for p in grp.split(','):
            p = p.strip().split(':')[-1].strip().split('=')[0].strip()
            if re.match(r'^[A-Za-z_$][\w$]*$', p): local.add(p)
    for grp in re.findall(r'(?:const|let|var)\s*\[([^\]]*)\]', code):
        for p in grp.split(','):
            p = p.strip().split('=')[0].strip()
            if re.match(r'^[A-Za-z_$][\w$]*$', p): local.add(p)
    for grp in re.findall(r'import\s*\{([^}]*)\}\s*from', code):
        for p in grp.split(','):
            p = p.strip().split(' as ')[-1].strip()
            if re.match(r'^[A-Za-z_$][\w$]*$', p): local.add(p)
    for m4 in re.findall(r'import\s+([A-Za-z_$][\w$]*)\s+from', code): local.add(m4)
    return local


KNOWN = set('''document window localStorage Math JSON Array Object Number String Date Map Set Promise Error WeakMap
 MouseEvent PointerEvent Event setTimeout clearTimeout setInterval clearInterval console navigator location history
 undefined NaN Infinity isNaN isFinite parseInt parseFloat encodeURIComponent decodeURIComponent requestAnimationFrame
 return if else for while do const let var function new this typeof instanceof void async await import export
 try catch finally throw break continue switch case default of in delete true false null class extends super
 arguments C from as'''.split())


def blocks(code):
    # top-level pieces: each `^(export )?function name(` block up to its `^}`, plus the module-level remainder
    out, rest, pos = [], [], 0
    for m in re.finditer(r'^(?:export )?function [\w$]*\s*\([^)]*\)\s*\{\n(.*?)^\}', code, re.M | re.S):
        rest.append(code[pos:m.start()]); out.append(m.group(0)); pos = m.end()
    rest.append(code[pos:])
    return out, '\n'.join(rest)


bad = 0
for chunk in ['src/scripts/homestead-phone.js', 'src/scripts/homestead-kitchen.js']:
    c = io.open(chunk, encoding='utf-8').read()
    code = strip_code(c)
    fns, module = blocks(code)
    mod_local = locals_of(module) | set(re.findall(r'^(?:export )?function ([\w$]+)', code, re.M))
    m = re.search(r'^let ([A-Za-z_$][\w$]*(?:, [A-Za-z_$][\w$]*)+);', c, re.M)
    have = set(x.strip() for x in m.group(1).split(',')) if m else set()
    missing = set()
    for piece in fns + [module]:
        local = locals_of(piece)
        ids = set(re.findall(r'(?<![\w.$])([A-Za-z_$][\w$]*)(?![\w$])', piece))
        keys = set(re.findall(r'(?<![\w.$?])([A-Za-z_$][\w$]*)\s*:(?!:)', piece))
        free = ids - local - mod_local - KNOWN - keys - {'state', 'inside', 'visiting'}
        missing |= {f for f in free if f not in have}
    print(chunk, '-> MISSING from init:', sorted(missing))
    bad += len(missing)
sys.exit(1 if bad else 0)
