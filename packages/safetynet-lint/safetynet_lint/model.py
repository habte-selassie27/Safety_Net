"""AST model for SafetyNet domain lint rules.

The official ``genvm-linter`` covers generic Python/SDK syntax. This model
exists so the SI rules can reason about SafetyNet-specific structure:
contracts, storage, public methods, non-deterministic blocks, and the shape of
the object that crosses the equivalence boundary.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass, field
from pathlib import Path


def dotted_name(node: ast.AST | None) -> str:
    """Return a dotted name for a Name/Attribute/Subscript/Call expression."""
    if node is None:
        return ""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = dotted_name(node.value)
        return f"{base}.{node.attr}" if base else node.attr
    if isinstance(node, ast.Call):
        return dotted_name(node.func)
    if isinstance(node, ast.Subscript):
        return dotted_name(node.value)
    return ""


def annotation_text(node: ast.AST | None) -> str:
    return ast.unparse(node) if node is not None else ""


def string_value(node: ast.AST | None) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def walk_scope(node: ast.AST):
    """Yield descendants of *node* without entering nested defs/classes."""
    stack = list(ast.iter_child_nodes(node))
    while stack:
        child = stack.pop()
        if isinstance(
            child,
            (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef),
        ):
            continue
        yield child
        stack.extend(ast.iter_child_nodes(child))


def calls_in(node: ast.AST) -> list[ast.Call]:
    return [child for child in ast.walk(node) if isinstance(child, ast.Call)]


def names_in(node: ast.AST) -> set[str]:
    return {child.id for child in ast.walk(node) if isinstance(child, ast.Name)}


@dataclass
class Param:
    name: str
    annotation: str
    default: str


@dataclass
class StorageField:
    name: str
    annotation: str
    line: int
    class_name: str
    is_contract: bool
    is_storage_struct: bool


@dataclass
class NondetCall:
    kind: str  # "web" | "llm" | "other"
    line: int
    col: int
    func: str
    method: str


@dataclass
class MethodModel:
    name: str
    node: ast.FunctionDef
    decorators: list[str]
    params: list[Param]
    returns: str
    is_view: bool
    is_write: bool
    is_payable: bool
    nondet: list[NondetCall] = field(default_factory=list)

    @property
    def line(self) -> int:
        return self.node.lineno


@dataclass
class ContractModel:
    name: str
    node: ast.ClassDef
    line: int
    storage: list[StorageField]
    methods: list[MethodModel]

    def method(self, name: str) -> MethodModel | None:
        for method in self.methods:
            if method.name == name:
                return method
        return None


@dataclass
class ModuleModel:
    path: str
    source: str
    tree: ast.Module
    contracts: list[ContractModel]
    classes: dict[str, ast.ClassDef]
    functions: dict[str, ast.FunctionDef]
    imports: set[str]
    calls: list[ast.Call]

    @property
    def lines(self) -> list[str]:
        return self.source.splitlines()

    def contract(self) -> ContractModel | None:
        return self.contracts[0] if self.contracts else None

    def method(self, name: str) -> MethodModel | None:
        for contract in self.contracts:
            method = contract.method(name)
            if method is not None:
                return method
        return None

    def function(self, name: str) -> ast.FunctionDef | None:
        return self.functions.get(name)

    def source_segment(self, node: ast.AST) -> str:
        try:
            return ast.get_source_segment(self.source, node) or ""
        except Exception:
            return ""


def _decorators(node: ast.ClassDef | ast.FunctionDef) -> list[str]:
    return [dotted_name(decorator) for decorator in node.decorator_list]


def _params(node: ast.FunctionDef) -> list[Param]:
    args = node.args
    positional = [*args.posonlyargs, *args.args]
    defaults = [None] * (len(positional) - len(args.defaults)) + list(args.defaults)
    params: list[Param] = []
    for arg, default in zip(positional, defaults, strict=True):
        params.append(
            Param(
                name=arg.arg,
                annotation=annotation_text(arg.annotation),
                default=annotation_text(default) if default is not None else "",
            )
        )
    for arg, default in zip(args.kwonlyargs, args.kw_defaults, strict=True):
        params.append(
            Param(
                name=arg.arg,
                annotation=annotation_text(arg.annotation),
                default=annotation_text(default) if default is not None else "",
            )
        )
    return params


def _is_contract_class(node: ast.ClassDef) -> bool:
    for base in node.bases:
        name = dotted_name(base)
        if name == "Contract" or name.endswith(".Contract"):
            return True
    return False


def _is_storage_struct(node: ast.ClassDef) -> bool:
    return any(
        dotted_name(decorator).endswith("allow_storage")
        for decorator in node.decorator_list
    )


def _nondet_calls(method_name: str, node: ast.FunctionDef) -> list[NondetCall]:
    found: list[NondetCall] = []
    for call in calls_in(node):
        func = dotted_name(call.func)
        if ".nondet." not in func and not func.startswith("nondet."):
            continue
        if ".web." in func:
            kind = "web"
        elif ".exec_" in func or "exec_prompt" in func:
            kind = "llm"
        else:
            kind = "other"
        found.append(
            NondetCall(
                kind=kind,
                line=call.lineno,
                col=call.col_offset + 1,
                func=func,
                method=method_name,
            )
        )
    return found


def build_model(path: str | Path, source: str | None = None) -> ModuleModel:
    path = str(path)
    if source is None:
        source = Path(path).read_text(encoding="utf-8")
    tree = ast.parse(source, filename=path)

    classes: dict[str, ast.ClassDef] = {}
    functions: dict[str, ast.FunctionDef] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            classes.setdefault(node.name, node)
        elif isinstance(node, ast.FunctionDef):
            functions.setdefault(node.name, node)

    imports: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split(".")[0])

    contracts: list[ContractModel] = []
    for class_name, class_node in classes.items():
        is_contract = _is_contract_class(class_node)
        is_struct = _is_storage_struct(class_node)
        if not is_contract and not is_struct:
            continue
        storage: list[StorageField] = []
        for statement in class_node.body:
            if isinstance(statement, ast.AnnAssign) and isinstance(
                statement.target, ast.Name
            ):
                storage.append(
                    StorageField(
                        name=statement.target.id,
                        annotation=annotation_text(statement.annotation),
                        line=statement.lineno,
                        class_name=class_name,
                        is_contract=is_contract,
                        is_storage_struct=is_struct,
                    )
                )
        if not is_contract:
            continue
        methods: list[MethodModel] = []
        for statement in class_node.body:
            if not isinstance(statement, ast.FunctionDef):
                continue
            decorators = _decorators(statement)
            is_view = any("view" in decorator for decorator in decorators)
            is_write = any("write" in decorator for decorator in decorators)
            is_payable = any("payable" in decorator for decorator in decorators)
            methods.append(
                MethodModel(
                    name=statement.name,
                    node=statement,
                    decorators=decorators,
                    params=_params(statement),
                    returns=annotation_text(statement.returns),
                    is_view=is_view,
                    is_write=is_write,
                    is_payable=is_payable,
                    nondet=_nondet_calls(statement.name, statement),
                )
            )
        contracts.append(
            ContractModel(
                name=class_name,
                node=class_node,
                line=class_node.lineno,
                storage=storage,
                methods=methods,
            )
        )

    calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)]
    return ModuleModel(
        path=path,
        source=source,
        tree=tree,
        contracts=contracts,
        classes=classes,
        functions=functions,
        imports=imports,
        calls=calls,
    )


def enclosing_method(model: ModuleModel, node: ast.AST) -> MethodModel | None:
    for contract in model.contracts:
        for method in contract.methods:
            if (
                method.node.lineno
                <= getattr(node, "lineno", 0)
                <= (method.node.end_lineno or method.node.lineno)
            ):
                return method
    return None
