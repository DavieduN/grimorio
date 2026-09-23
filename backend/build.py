import os
import json
import hashlib
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.getenv("DADOS_PATH", os.path.abspath(os.path.join(SCRIPT_DIR, "../data")))
BUILD_DIR = os.getenv("BUILD_PATH", os.path.abspath(os.path.join(SCRIPT_DIR, "../build")))

LATEX_PREAMBLE = r"""\documentclass[10pt,a4paper,twocolumn]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath, amssymb}
\usepackage{listings}
\usepackage{xcolor}
\usepackage{geometry}
\geometry{left=1cm,right=1cm,top=1cm,bottom=1.5cm}

\lstset{
    language=C++,
    basicstyle=\ttfamily\scriptsize,
    keywordstyle=\color{blue},
    commentstyle=\color{gray},
    stringstyle=\color{red},
    breaklines=true,
    showstringspaces=false,
    tabsize=2,
    numbers=none,
    extendedchars=true,
    literate={á}{{\'a}}1 {ã}{{\~a}}1 {é}{{\'e}}1 {ê}{{\^e}}1 {í}{{\'i}}1 {ó}{{\'o}}1 {õ}{{\~o}}1 {ô}{{\^o}}1 {ú}{{\'u}}1 {ç}{{\c{c}}}1 {Á}{{\'A}}1 {Ã}{{\~A}}1 {É}{{\'E}}1 {Ê}{{\^E}}1 {Í}{{\'I}}1 {Ó}{{\'O}}1 {Õ}{{\~O}}1 {Ô}{{\^O}}1 {Ú}{{\'U}}1 {Ç}{{\c{C}}}1
}

\begin{document}
\twocolumn
\tableofcontents
\newpage
"""

LATEX_END = r"\end{document}"

def compute_hash(lines_subset):
    # Remove #warning como a UFMG faz antes do pré-processador
    clean_lines = [l for l in lines_subset if not l.lstrip().startswith("#warning")]
    text = "\n".join(clean_lines) + "\n"
    
    # Roda o pré-processador do C nativamente
    proc = subprocess.run(
        ["cpp", "-dD", "-P", "-fpreprocessed"], 
        input=text.encode('utf-8'), 
        capture_output=True
    )
    out = proc.stdout.decode('utf-8', errors='ignore')
    
    # Tira espaços e quebras de linha
    out = ''.join(out.split())
    if not out:
        return "   "
    return hashlib.md5(out.encode('utf-8')).hexdigest()[:3]

def process_code_ufmg(code_str):
    lines = code_str.split('\n')
    out_lines = []
    depth = 0
    st = []
    started_code = False
    
    for line_idx, line in enumerate(lines):
        start_line = line_idx # Por padrão, o hash é só dessa linha
        
        for c in line:
            if c == '{':
                depth += 1
                st.append(line_idx)
            elif c == '}':
                if depth > 0:
                    depth -= 1
                    start_line = st.pop() # Se fechou bloco, o hash pega desde a abertura
                    
        stripped = line.strip()
        is_comment = not stripped or stripped.startswith('//') or stripped.startswith('/*')
        
        if not is_comment:
            started_code = True
            
        prefix = ""
        if started_code:
            if is_comment:
                if depth != 0:
                    prefix = "    " # Mantém o alinhamento para comentários dentro de blocos
            else:
                subset = lines[start_line : line_idx + 1]
                h = compute_hash(subset)
                prefix = f"{h} "
                
        out_lines.append(prefix + line)
        
    return "\n".join(out_lines)

def main():
    config_path = os.path.join(DATA_DIR, "config.json")
    out_tex_path = os.path.join(BUILD_DIR, "grimorio.tex")
    
    if not os.path.exists(config_path):
        print(f"Erro: {config_path} não encontrado.")
        return

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    tex_content = [LATEX_PREAMBLE]

    if "intro" in config and config["intro"]:
        tex_content.append(r"\section{Introdução}")
        for item in config["intro"]:
            tex_path = os.path.join(DATA_DIR, "intro", f"{item}.tex")
            cpp_path = os.path.join(DATA_DIR, "intro", f"{item}.cpp")
            
            if os.path.exists(tex_path):
                with open(tex_path, 'r', encoding='utf-8') as f:
                    tex_content.append(f.read() + "\n")
            elif os.path.exists(cpp_path):
                with open(cpp_path, 'r', encoding='utf-8') as f:
                    tex_content.append(r"\begin{lstlisting}")
                    tex_content.append(f.read())
                    tex_content.append(r"\end{lstlisting}")

    notebook = config.get("notebook", {})
    for section_name, algorithms in notebook.items():
        tex_content.append(rf"\section{{{section_name}}}")
        
        for algo in algorithms:
            algo_name = algo.replace(".cpp", "")
            code_path = os.path.join(DATA_DIR, "code", f"{algo_name}.cpp")
            header_path = os.path.join(DATA_DIR, "header", f"{algo_name}.tex")
            
            title = algo_name.replace('_', ' ').title()
            tex_content.append(rf"\subsection{{{title}}}")

            if os.path.exists(header_path):
                with open(header_path, 'r', encoding='utf-8') as f:
                    tex_content.append(f.read())
                tex_content.append(r"\vspace{0.2cm}")

            if os.path.exists(code_path):
                with open(code_path, 'r', encoding='utf-8') as f:
                    code_str = f.read()
                hashed_code = process_code_ufmg(code_str)
                tex_content.append(r"\begin{lstlisting}")
                tex_content.append(hashed_code)
                tex_content.append(r"\end{lstlisting}")

    if "theory" in config and config["theory"]:
        tex_content.append(r"\section{Teoria e Apêndices}")
        for item in config["theory"]:
            tex_path = os.path.join(DATA_DIR, "theory", f"{item}.tex")
            if os.path.exists(tex_path):
                title = item.replace('_', ' ').title()
                tex_content.append(rf"\subsection{{{title}}}")
                with open(tex_path, 'r', encoding='utf-8') as f:
                    tex_content.append(f.read() + "\n")

    tex_content.append(LATEX_END)

    with open(out_tex_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(tex_content))

    print(f"Arquivo gerado! Iniciando compilação no diretório: {BUILD_DIR}")

    for _ in range(2):
        result = subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", f"-output-directory={BUILD_DIR}", out_tex_path],
            capture_output=True, errors="replace", text=True
        )

    if result.returncode == 0:
        print(f"Sucesso! PDF gerado em: {os.path.join(BUILD_DIR, 'grimorio.pdf')}")
    else:
        print(f"Erro na compilação do LaTeX. Cheque o arquivo {os.path.join(BUILD_DIR, 'grimorio.log')}")

if __name__ == "__main__":
    main()