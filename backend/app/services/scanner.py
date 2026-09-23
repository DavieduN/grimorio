import os
from app.models.schemas import Module, ModuleFiles

DATA_PATH = os.getenv("DATA_PATH", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data")))

def scan_library() -> dict[str, Module]:
    modules: dict[str, Module] = {}
    
    valid_directories = list(ModuleFiles.model_fields.keys())
    
    for directory in valid_directories:
        dir_path = os.path.join(DATA_PATH, directory)
        if not os.path.exists(dir_path):
            continue
            
        for filename in os.listdir(dir_path):
            if filename.startswith("."):
                continue
                
            base_name, ext = os.path.splitext(filename)
            
            if base_name not in modules:
                modules[base_name] = Module(id=base_name)
                
            setattr(modules[base_name].files, directory, filename)

    for m_id, m in modules.items():
        m.load_meta_data(DATA_PATH)
        
        if not m.files.code and not m.files.theory:
            m.valid = False
            m.validation_errors.append("Incomplete module: No code and no theory.")
            
        if m.files.header and not m.files.code:
            m.valid = False
            m.validation_errors.append("Incomplete module: Has header but no code.")

    return modules