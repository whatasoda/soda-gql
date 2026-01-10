//! Import management module.
//!
//! This module handles:
//! - Adding the `@soda-gql/runtime` import/require
//! - Removing the `graphql-system` imports

use swc_core::common::{SyntaxContext, DUMMY_SP};
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{VisitMut, VisitMutWith};

const RUNTIME_MODULE: &str = "@soda-gql/runtime";
const RUNTIME_IMPORT_NAME: &str = "gqlRuntime";
const CJS_RUNTIME_NAME: &str = "__soda_gql_runtime";

/// Manages imports for the transformation.
pub struct ImportManager {
    needs_runtime_import: bool,
    is_cjs: bool,
    graphql_system_aliases: Vec<String>,
    has_added_import: bool,
}

impl ImportManager {
    pub fn new(needs_runtime_import: bool, is_cjs: bool, graphql_system_aliases: &[String]) -> Self {
        Self {
            needs_runtime_import,
            is_cjs,
            graphql_system_aliases: graphql_system_aliases.to_vec(),
            has_added_import: false,
        }
    }

    /// Check if a specifier is a graphql-system import.
    fn is_graphql_system_import(&self, specifier: &str) -> bool {
        self.graphql_system_aliases.iter().any(|alias| {
            specifier == alias || specifier.starts_with(&format!("{}/", alias))
        })
    }

    /// Create the ESM runtime import.
    fn create_esm_import(&self) -> ModuleItem {
        // import { gqlRuntime } from "@soda-gql/runtime";
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers: vec![ImportSpecifier::Named(ImportNamedSpecifier {
                span: DUMMY_SP,
                local: Ident::new(RUNTIME_IMPORT_NAME.into(), DUMMY_SP, Default::default()),
                imported: None,
                is_type_only: false,
            })],
            src: Box::new(Str {
                span: DUMMY_SP,
                value: RUNTIME_MODULE.into(),
                raw: None,
            }),
            type_only: false,
            with: None,
            phase: ImportPhase::Evaluation,
        }))
    }

    /// Create the CJS runtime require.
    fn create_cjs_require(&self) -> ModuleItem {
        // const __soda_gql_runtime = require("@soda-gql/runtime");
        ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(VarDecl {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            kind: VarDeclKind::Const,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: Pat::Ident(BindingIdent {
                    id: Ident::new(CJS_RUNTIME_NAME.into(), DUMMY_SP, Default::default()),
                    type_ann: None,
                }),
                init: Some(Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    ctxt: SyntaxContext::empty(),
                    callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                        "require".into(),
                        DUMMY_SP,
                        Default::default(),
                    )))),
                    args: vec![ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: RUNTIME_MODULE.into(),
                            raw: None,
                        }))),
                    }],
                    type_args: None,
                }))),
                definite: false,
            }],
        }))))
    }

    /// Check if a variable declaration is a require for graphql-system.
    fn is_graphql_system_require(&self, decl: &VarDeclarator) -> bool {
        if let Some(init) = &decl.init {
            if let Some(specifier) = extract_require_specifier(init) {
                return self.is_graphql_system_import(&specifier);
            }
        }
        false
    }

    /// Check if an import already has the runtime import.
    fn has_runtime_import(&self, import: &ImportDecl) -> bool {
        if !wtf8_eq(&import.src.value, RUNTIME_MODULE) {
            return false;
        }

        import.specifiers.iter().any(|spec| {
            if let ImportSpecifier::Named(named) = spec {
                atom_eq(&named.local.sym, RUNTIME_IMPORT_NAME)
            } else {
                false
            }
        })
    }
}

impl VisitMut for ImportManager {
    fn visit_mut_module(&mut self, module: &mut Module) {
        // First, visit children to handle nested transformations
        module.visit_mut_children_with(self);

        // Collect new body items
        let mut new_body: Vec<ModuleItem> = Vec::new();
        let mut import_insert_pos = 0;
        let mut found_non_import = false;
        let mut existing_runtime_import_idx: Option<usize> = None;

        for (_idx, item) in module.body.iter().enumerate() {
            match item {
                // Handle ESM imports
                ModuleItem::ModuleDecl(ModuleDecl::Import(import)) => {
                    let specifier = wtf8_to_string(&import.src.value);

                    // Skip graphql-system imports
                    if self.is_graphql_system_import(&specifier) {
                        continue;
                    }

                    // Check if this is already the runtime import
                    if specifier == RUNTIME_MODULE {
                        existing_runtime_import_idx = Some(new_body.len());
                    }

                    import_insert_pos = new_body.len() + 1;
                    new_body.push(item.clone());
                }

                // Handle CJS require statements
                ModuleItem::Stmt(Stmt::Decl(Decl::Var(var_decl))) => {
                    // Filter out graphql-system requires
                    let filtered_decls: Vec<VarDeclarator> = var_decl
                        .decls
                        .iter()
                        .filter(|decl| !self.is_graphql_system_require(decl))
                        .cloned()
                        .collect();

                    if filtered_decls.is_empty() {
                        // All declarations were graphql-system requires, skip
                        continue;
                    }

                    if filtered_decls.len() < var_decl.decls.len() {
                        // Some declarations were filtered
                        new_body.push(ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(
                            VarDecl {
                                span: var_decl.span,
                                ctxt: var_decl.ctxt,
                                kind: var_decl.kind,
                                declare: var_decl.declare,
                                decls: filtered_decls,
                            },
                        )))));
                    } else {
                        new_body.push(item.clone());
                    }

                    if !found_non_import {
                        import_insert_pos = new_body.len();
                    }
                    found_non_import = true;
                }

                _ => {
                    if !found_non_import {
                        import_insert_pos = new_body.len();
                    }
                    found_non_import = true;
                    new_body.push(item.clone());
                }
            }
        }

        // Add runtime import if needed
        if self.needs_runtime_import && !self.has_added_import {
            // Check if we already have the runtime import
            let already_has_import = existing_runtime_import_idx.map_or(false, |idx| {
                if let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = &new_body[idx] {
                    self.has_runtime_import(import)
                } else {
                    false
                }
            });

            if !already_has_import {
                if let Some(idx) = existing_runtime_import_idx {
                    // Merge with existing import
                    if let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = &mut new_body[idx] {
                        let mut specifiers = import.specifiers.clone();
                        specifiers.push(ImportSpecifier::Named(ImportNamedSpecifier {
                            span: DUMMY_SP,
                            local: Ident::new(RUNTIME_IMPORT_NAME.into(), DUMMY_SP, Default::default()),
                            imported: None,
                            is_type_only: false,
                        }));
                        import.specifiers = specifiers;
                    }
                } else {
                    // Add new import
                    let runtime_import = if self.is_cjs {
                        self.create_cjs_require()
                    } else {
                        self.create_esm_import()
                    };
                    new_body.insert(import_insert_pos, runtime_import);
                }
                self.has_added_import = true;
            }
        }

        module.body = new_body;
    }
}

/// Extract the module specifier from a require() call.
fn extract_require_specifier(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Call(call) => {
            // Direct require("...")
            if let Callee::Expr(callee) = &call.callee {
                if let Expr::Ident(ident) = &**callee {
                    if atom_eq(&ident.sym, "require") {
                        if let Some(arg) = call.args.first() {
                            if let Expr::Lit(Lit::Str(s)) = &*arg.expr {
                                return Some(wtf8_to_string(&s.value));
                            }
                        }
                    }

                    // __importDefault(require("...")) or __importStar(require("..."))
                    if atom_eq(&ident.sym, "__importDefault") || atom_eq(&ident.sym, "__importStar") {
                        if let Some(arg) = call.args.first() {
                            return extract_require_specifier(&arg.expr);
                        }
                    }
                }
            }
            None
        }
        _ => None,
    }
}

/// Helper to compare an Atom with a string.
fn atom_eq<T: AsRef<str>>(atom: &T, s: &str) -> bool {
    atom.as_ref() == s
}

/// Helper to compare a Wtf8Atom (string literal value) with a string.
fn wtf8_eq(atom: &swc_core::atoms::Wtf8Atom, s: &str) -> bool {
    atom.to_string_lossy() == s
}

/// Helper to convert a Wtf8Atom to String.
fn wtf8_to_string(atom: &swc_core::atoms::Wtf8Atom) -> String {
    atom.to_string_lossy().into_owned()
}
