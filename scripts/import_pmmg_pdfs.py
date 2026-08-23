#!/usr/bin/env python3
"""Extrai questões de PDFs PMMG fornecidos pelo usuário e gera catálogo web.

O script não infere gabaritos: marca todas as respostas como pendentes de revisão.
"""
import hashlib, json, re, subprocess, sys
from pathlib import Path

QUESTION = re.compile(r"(?m)^\s*(\d{1,3})\s*[ªaºo]?\s*QUEST[ÃA]O\s*[-–—:]\s*")
OPTION = re.compile(r"(?m)^\s*([A-E])\s*[.)-]\s*(?:\(\s*\)\s*)?")
HEADINGS = {
    "Linguagens": ("PORTUGUESA", "LÍNGUA PORTUGUESA", "INTERPRETAÇÃO", "GRAMÁTICA", "REDAÇÃO"),
    "Raciocínio Lógico": ("RACIOCÍNIO LÓGICO", "MATEMÁTICA"),
    "Direito": ("DIREITO CONSTITUCIONAL", "DIREITO PENAL", "DIREITO PROCESSUAL", "DIREITO ADMINISTRATIVO"),
    "Legislação Policial": ("LEGISLAÇÃO", "DIREITOS HUMANOS", "ESTATUTO", "CÓDIGO DE ÉTICA"),
    "Conhecimentos Gerais": ("CONHECIMENTOS GERAIS", "ATUALIDADES", "INFORMÁTICA", "HISTÓRIA", "GEOGRAFIA"),
}

def axis_for(context):
    upper = context.upper()
    found = [(upper.rfind(term), axis) for axis, terms in HEADINGS.items() for term in terms if term in upper]
    return max(found, default=(-1, "Conhecimentos Gerais"))[1]

def extract(pdf):
    text = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], check=True, capture_output=True, text=True).stdout
    matches = list(QUESTION.finditer(text)); result = []
    for idx, match in enumerate(matches):
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        block = text[match.end():end].replace("\f", " ").strip()
        options = list(OPTION.finditer(block))
        if len(options) < 3 or len(options) > 5: continue
        statement = re.sub(r"\s+", " ", block[:options[0].start()]).strip()
        answers = [re.sub(r"\s+", " ", block[o.end():(options[i+1].start() if i+1<len(options) else len(block))]).strip() for i,o in enumerate(options)]
        if not statement or any(not answer for answer in answers): continue
        year = int(re.search(r"(20\d{2})", pdf.name).group(1)); career = "CFSD" if pdf.name.startswith("CFSD") else "CFO"
        digest = hashlib.sha256(f"{career}:{year}:{match.group(1)}:{statement}".encode()).hexdigest()[:20]
        result.append({"id":digest,"career":career,"year":year,"number":int(match.group(1)),"axis":axis_for(text[max(0,match.start()-2500):match.start()]),"statement":statement,"options":answers,"answer":None,"reviewStatus":"pending","sourcePdf":pdf.name,"kind":"official"})
    return result

def main():
    source, output = Path(sys.argv[1]), Path(sys.argv[2]); output.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(source.rglob("*Prova*.pdf")); questions = []
    catalog = []
    for pdf in pdfs:
        items = extract(pdf); questions.extend(items)
        year = int(re.search(r"(20\d{2})", pdf.name).group(1)); career = "CFSD" if pdf.name.startswith("CFSD") else "CFO"
        catalog.append({"career":career,"year":year,"file":pdf.name,"questionCount":len(items)})
    (output/"questions.json").write_text(json.dumps(questions, ensure_ascii=False, separators=(",",":")), encoding="utf-8")
    (output/"exams.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(pdfs)} provas, {len(questions)} questões extraídas")

if __name__ == "__main__": main()
