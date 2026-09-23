from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import json
import os

class ModuleFiles(BaseModel):
    code: Optional[str] = None
    theory: Optional[str] = None
    header: Optional[str] = None 
    meta: Optional[str] = None

class LocalOverride(BaseModel):
    keep_theory_with_code: Optional[bool] = None
    print_header: Optional[bool] = None
    omit_code: Optional[bool] = False
    omit_theory: Optional[bool] = False

class Module(BaseModel):
    id: str
    files: ModuleFiles = Field(default_factory=ModuleFiles)
    overrides: LocalOverride = Field(default_factory=LocalOverride)
    tags: List[str] = Field(default_factory=list)
    valid: bool = True
    validation_errors: List[str] = Field(default_factory=list)

    def load_meta_data(self, base_path: str):
        if not self.files.meta:
            return
            
        meta_path = os.path.join(base_path, "meta", self.files.meta)
        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.tags = data.get("tags", [])
        except Exception as e:
            self.valid = False
            self.validation_errors.append(f"Meta JSON corrupted or read error: {str(e)}")

class GlobalConfig(BaseModel):
    code_before_theory: bool = True
    print_headers: bool = True
    keep_theory_with_code: bool = False
    fallback_code_section_name: str = "Other"
    fallback_theory_section_name: str = "Other"
    code_notebook_title: str = "Code"
    theory_notebook_title: str = "Theoretical"

class NotebookLayout(BaseModel):
    code_sections: Dict[str, List[str]] = {}
    theory_sections: Dict[str, List[str]] = {}

class BuildRequest(BaseModel):
    global_config: GlobalConfig = Field(default_factory=GlobalConfig)
    layout: NotebookLayout = Field(default_factory=NotebookLayout)
    modules: Dict[str, Module] = Field(default_factory=dict)

