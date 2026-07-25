import os
import sys

# Permite `from app.ingest_core import ...` en los tests sin importar desde dónde se invoque pytest.
sys.path.insert(0, os.path.dirname(__file__))
