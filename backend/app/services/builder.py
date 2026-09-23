import os
import hashlib
import subprocess
from typing import List, Dict
from app.models.schemas import BuildRequest, Module

DATA_PATH = os.getenv("DATA_PATH", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data")))
BUILD_PATH = os.getenv("BUILD_PATH", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../build")))

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
"""

class NotebookBuilder:
    def __init__(self, request: BuildRequest):
        self.config = request.global_config
        self.layout = request.layout
        self.modules = {k: v for k, v in request.modules.items() if v.valid}
        self.tex_lines = [LATEX_PREAMBLE]
        
        self.code_sections: Dict[str, List[Module]] = {}
        self.theory_sections: Dict[str, List[Module]] = {}

    def _compute_hash(self, lines_subset: List[str]) -> str:
        clean_lines = [l for l in lines_subset if not l.lstrip().startswith("#warning")]
        text = "\n".join(clean_lines) + "\n"
        proc = subprocess.run(
            ["cpp", "-dD", "-P", "-fpreprocessed"], 
            input=text.encode('utf-8'), 
            capture_output=True
        )
        out = proc.stdout.decode('utf-8', errors='ignore')
        out = ''.join(out.split())
        if not out:
            return "   "
        return hashlib.md5(out.encode('utf-8')).hexdigest()[:3]

    def _process_cpp_code(self, code_str: str) -> str:
        lines = code_str.split('\n')
        out_lines = []
        depth = 0
        st = []
        started_code = False
        
        for line_idx, line in enumerate(lines):
            start_line = line_idx 
            for c in line:
                if c == '{':
                    depth += 1
                    st.append(line_idx)
                elif c == '}':
                    if depth > 0:
                        depth -= 1
                        start_line = st.pop()
                        
            stripped = line.strip()
            is_comment = not stripped or stripped.startswith('//') or stripped.startswith('/*')
            
            if not is_comment:
                started_code = True
                
            prefix = ""
            if started_code:
                if is_comment:
                    if depth != 0:
                        prefix = "    " 
                else:
                    subset = lines[start_line : line_idx + 1]
                    h = self._compute_hash(subset)
                    prefix = f"{h} "
                    
            out_lines.append(prefix + line)
        return "\n".join(out_lines)

    def _get_section_for_module(self, mod_id: str, layout_dict: Dict[str, List[str]], fallback_name: str) -> str:
        for section_name, items in layout_dict.items():
            if mod_id in items:
                return section_name
        return fallback_name

    def _add_to_dict(self, target_dict: Dict[str, List[Module]], section: str, mod: Module):
        if section not in target_dict:
            target_dict[section] = []
        target_dict[section].append(mod)

    def _route_modules(self):
        for mod_id, mod in self.modules.items():
            if mod.overrides.omit_code:
                mod.files.code = None
                mod.files.header = None
            if mod.overrides.omit_theory:
                mod.files.theory = None

            has_code = bool(mod.files.code)
            has_theory = bool(mod.files.theory)
            
            if not has_code and not has_theory:
                continue
            
            keep_theory = self.config.keep_theory_with_code
            if mod.overrides.keep_theory_with_code is not None:
                keep_theory = mod.overrides.keep_theory_with_code

            if has_code and has_theory:
                if keep_theory:
                    sec = self._get_section_for_module(mod_id, self.layout.code_sections, self.config.fallback_code_section_name)
                    self._add_to_dict(self.code_sections, sec, mod)
                else:
                    mod_code = mod.model_copy(deep=True)
                    mod_code.files.theory = None
                    sec_code = self._get_section_for_module(mod_id, self.layout.code_sections, self.config.fallback_code_section_name)
                    self._add_to_dict(self.code_sections, sec_code, mod_code)
                    
                    mod_theory = mod.model_copy(deep=True)
                    mod_theory.files.code = None
                    mod_theory.files.header = None
                    sec_theory = self._get_section_for_module(mod_id, self.layout.theory_sections, self.config.fallback_theory_section_name)
                    self._add_to_dict(self.theory_sections, sec_theory, mod_theory)
                    
            elif has_code:
                sec = self._get_section_for_module(mod_id, self.layout.code_sections, self.config.fallback_code_section_name)
                self._add_to_dict(self.code_sections, sec, mod)
                
            elif has_theory:
                sec = self._get_section_for_module(mod_id, self.layout.theory_sections, self.config.fallback_theory_section_name)
                self._add_to_dict(self.theory_sections, sec, mod)

    def _render_module(self, mod: Module):
        title = mod.id.replace('_', ' ').title()
        self.tex_lines.append(rf"\subsection{{{title}}}")

        print_header = self.config.print_headers
        if mod.overrides.print_header is not None:
            print_header = mod.overrides.print_header

        if print_header and mod.files.header and mod.files.code:
            header_path = os.path.join(DATA_PATH, "header", mod.files.header)
            if os.path.exists(header_path):
                with open(header_path, 'r', encoding='utf-8') as f:
                    self.tex_lines.append(f.read() + "\n")

        if mod.files.code:
            code_path = os.path.join(DATA_PATH, "code", mod.files.code)
            if os.path.exists(code_path):
                with open(code_path, 'r', encoding='utf-8') as f:
                    hashed_code = self._process_cpp_code(f.read())
                self.tex_lines.append(r"\begin{lstlisting}")
                self.tex_lines.append(hashed_code)
                self.tex_lines.append(r"\end{lstlisting}")
                
        if mod.files.theory:
            theory_path = os.path.join(DATA_PATH, "theory", mod.files.theory)
            if os.path.exists(theory_path):
                with open(theory_path, 'r', encoding='utf-8') as f:
                    self.tex_lines.append(f.read() + "\n")

    def _render_notebook_part(self, title: str, sections_dict: Dict[str, List[Module]], fallback_name: str):
        if not sections_dict:
            return

        self.tex_lines.append(rf"\part{{{title}}}")

        self.tex_lines.append(r"\setcounter{section}{0}")
        self.tex_lines.append(r"\setcounter{subsection}{0}")
        
        if len(sections_dict) == 1 and fallback_name in sections_dict:
            self.tex_lines.append(r"\begingroup")
            self.tex_lines.append(r"\renewcommand{\thesubsection}{\arabic{subsection}}") 
            
            modules = sorted(sections_dict[fallback_name], key=lambda m: m.id)
            for mod in modules:
                self._render_module(mod)
                
            self.tex_lines.append(r"\endgroup")
            return

        sec_names = sorted([s for s in sections_dict.keys() if s != fallback_name])
        if fallback_name in sections_dict:
            sec_names.append(fallback_name)

        for sec_name in sec_names:
            if not sections_dict[sec_name]:
                continue
                
            self.tex_lines.append(rf"\section{{{sec_name}}}")
            
            modules = sorted(sections_dict[sec_name], key=lambda m: m.id)
            for mod in modules:
                self._render_module(mod)

    def generate(self) -> str:
        from app.core.logger import logger
        
        self._route_modules()

        if self.code_sections and self.theory_sections:
            self.tex_lines.append(r"\tableofcontents")
            self.tex_lines.append(r"\newpage")

        if self.config.code_before_theory:
            self._render_notebook_part(self.config.code_notebook_title, self.code_sections, self.config.fallback_code_section_name)
            self._render_notebook_part(self.config.theory_notebook_title, self.theory_sections, self.config.fallback_theory_section_name)
        else:
            self._render_notebook_part(self.config.theory_notebook_title, self.theory_sections, self.config.fallback_theory_section_name)
            self._render_notebook_part(self.config.code_notebook_title, self.code_sections, self.config.fallback_code_section_name)

        if not self.code_sections and not self.theory_sections:
            self.tex_lines.append(r"\mbox{}") 
            
        self.tex_lines.append(r"\end{document}")
        
        out_tex_path = os.path.join(BUILD_PATH, "grimorio.tex")
        with open(out_tex_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(self.tex_lines))

        logger.info("Starting LaTeX compilation (2 passes)...")
        for i in range(2):
            result = subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", f"-output-directory={BUILD_PATH}", out_tex_path],
                capture_output=True, errors="replace"
            )
            
            if result.returncode != 0:
                logger.error(f"pdflatex failed on pass {i+1}. Return code: {result.returncode}")
                
                log_file = os.path.join(BUILD_PATH, "grimorio.log")
                if os.path.exists(log_file):
                    with open(log_file, 'r', encoding='utf-8', errors='replace') as lf:
                        lines = lf.readlines()
                        logger.error("Last lines of LaTeX log:\n" + "".join(lines[-20:]))
                
                raise RuntimeError("LaTeX compilation failed. Check console logs.")
            
        return os.path.join(BUILD_PATH, "grimorio.pdf")