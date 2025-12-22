//! Metadata collection module.
//!
//! This module collects metadata about GQL definitions in the source code:
//! - AST path (canonical path)
//! - Export bindings
//! - Scope tracking

use std::collections::HashMap;
use swc_core::common::Span;
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitWith};

/// Metadata about a GQL definition.
#[derive(Debug, Clone)]
pub struct GqlDefinitionMetadata {
    /// The AST path for canonical ID resolution.
    pub ast_path: String,
    /// Whether this is a top-level definition.
    #[allow(dead_code)]
    pub is_top_level: bool,
    /// Whether this definition is exported.
    #[allow(dead_code)]
    pub is_exported: bool,
    /// The export binding name, if exported.
    #[allow(dead_code)]
    pub export_binding: Option<String>,
}

/// Map from call expression span to metadata.
pub type MetadataMap = HashMap<Span, GqlDefinitionMetadata>;

/// Map from local name to export name.
type ExportBindingMap = HashMap<String, String>;

/// Collects metadata about GQL definitions in a module.
pub struct MetadataCollector {
    #[allow(dead_code)]
    source_path: String,
    export_bindings: ExportBindingMap,
    scope_stack: Vec<ScopeFrame>,
    metadata: MetadataMap,
    anonymous_counters: HashMap<String, usize>,
    #[allow(dead_code)]
    definition_counter: usize,
}

struct ScopeFrame {
    segment: String,
    #[allow(dead_code)]
    kind: String,
}

impl MetadataCollector {
    /// Collect metadata from a module.
    pub fn collect(module: &Module, source_path: &str) -> MetadataMap {
        let export_bindings = Self::collect_export_bindings(module);

        let mut collector = Self {
            source_path: source_path.to_string(),
            export_bindings,
            scope_stack: Vec::new(),
            metadata: HashMap::new(),
            anonymous_counters: HashMap::new(),
            definition_counter: 0,
        };

        module.visit_with(&mut collector);
        collector.metadata
    }

    /// Collect export bindings from the module.
    fn collect_export_bindings(module: &Module) -> ExportBindingMap {
        let mut bindings = HashMap::new();

        for item in &module.body {
            match item {
                // ESM: export { foo }
                ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export)) => {
                    if export.src.is_none() {
                        for spec in &export.specifiers {
                            if let ExportSpecifier::Named(named) = spec {
                                let local = match &named.orig {
                                    ModuleExportName::Ident(id) => atom_to_string(&id.sym),
                                    ModuleExportName::Str(s) => wtf8_to_string(&s.value),
                                };
                                let exported = match &named.exported {
                                    Some(ModuleExportName::Ident(id)) => atom_to_string(&id.sym),
                                    Some(ModuleExportName::Str(s)) => wtf8_to_string(&s.value),
                                    None => local.clone(),
                                };
                                bindings.insert(local, exported);
                            }
                        }
                    }
                }

                // ESM: export const foo = ...
                ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) => {
                    if let Decl::Var(var_decl) = &export.decl {
                        for decl in &var_decl.decls {
                            if let Pat::Ident(ident) = &decl.name {
                                let name = atom_to_string(&ident.id.sym);
                                bindings.insert(name.clone(), name);
                            }
                        }
                    } else if let Decl::Fn(fn_decl) = &export.decl {
                        let name = atom_to_string(&fn_decl.ident.sym);
                        bindings.insert(name.clone(), name);
                    } else if let Decl::Class(class_decl) = &export.decl {
                        let name = atom_to_string(&class_decl.ident.sym);
                        bindings.insert(name.clone(), name);
                    }
                }

                // CommonJS: exports.foo = ... or module.exports.foo = ...
                ModuleItem::Stmt(Stmt::Expr(expr_stmt)) => {
                    if let Expr::Assign(assign) = &*expr_stmt.expr {
                        if let Some(name) = get_commonjs_export_name(&assign.left) {
                            bindings.insert(name.clone(), name);
                        }
                    }
                }

                _ => {}
            }
        }

        bindings
    }

    /// Get the current AST path.
    fn get_ast_path(&self) -> String {
        self.scope_stack
            .iter()
            .map(|f| f.segment.clone())
            .collect::<Vec<_>>()
            .join(".")
    }

    /// Get an anonymous name for a scope kind (not currently used but kept for future).
    #[allow(dead_code)]
    fn get_anonymous_name(&mut self, kind: &str) -> String {
        let count = self.anonymous_counters.entry(kind.to_string()).or_insert(0);
        let name = format!("{}#{}", kind, count);
        *count += 1;
        name
    }

    /// Register a definition and get its AST path.
    /// The AST path is the scope segments joined by `.`, with `$N` suffix for duplicates.
    fn register_definition(&mut self) -> String {
        let base_path = self.get_ast_path();

        // Track occurrences for uniqueness
        let count = self.anonymous_counters.entry(base_path.clone()).or_insert(0);
        let path = if *count == 0 {
            base_path.clone()
        } else {
            format!("{}${}", base_path, count)
        };
        *count += 1;
        path
    }

    /// Enter a scope.
    fn enter_scope(&mut self, segment: String, kind: &str) {
        self.scope_stack.push(ScopeFrame {
            segment,
            kind: kind.to_string(),
        });
    }

    /// Exit a scope.
    fn exit_scope(&mut self) {
        self.scope_stack.pop();
    }

    /// Check if a call expression is a GQL definition call.
    fn is_gql_definition_call(&self, call: &CallExpr) -> bool {
        // Check if callee is gql.* pattern
        if let Callee::Expr(expr) = &call.callee {
            if let Expr::Member(member) = &**expr {
                if is_gql_reference(&member.obj) {
                    // Check if first argument is an arrow function
                    if let Some(first_arg) = call.args.first() {
                        return matches!(&*first_arg.expr, Expr::Arrow(_));
                    }
                }
            }
        }
        false
    }

    /// Resolve top-level export info for a call.
    fn resolve_export_info(&self, _call: &CallExpr) -> Option<String> {
        // This is a simplified version - in practice, you'd need to track
        // parent nodes to find the variable declaration or assignment
        // For now, we'll look at the scope stack
        if self.scope_stack.len() == 1 {
            let binding_name = &self.scope_stack[0].segment;
            self.export_bindings.get(binding_name).cloned()
        } else {
            None
        }
    }
}

impl Visit for MetadataCollector {
    fn visit_var_declarator(&mut self, decl: &VarDeclarator) {
        if let Pat::Ident(ident) = &decl.name {
            let name = atom_to_string(&ident.id.sym);
            self.enter_scope(name, "variable");
            decl.visit_children_with(self);
            self.exit_scope();
        } else {
            decl.visit_children_with(self);
        }
    }

    fn visit_fn_decl(&mut self, decl: &FnDecl) {
        let name = atom_to_string(&decl.ident.sym);
        self.enter_scope(name, "function");
        decl.visit_children_with(self);
        self.exit_scope();
    }

    fn visit_fn_expr(&mut self, expr: &FnExpr) {
        let name = expr
            .ident
            .as_ref()
            .map(|i| atom_to_string(&i.sym))
            .unwrap_or_else(|| self.get_anonymous_name("function"));
        self.enter_scope(name, "function");
        expr.visit_children_with(self);
        self.exit_scope();
    }

    fn visit_arrow_expr(&mut self, expr: &ArrowExpr) {
        let name = self.get_anonymous_name("arrow");
        self.enter_scope(name, "function");
        expr.visit_children_with(self);
        self.exit_scope();
    }

    fn visit_class_decl(&mut self, decl: &ClassDecl) {
        let name = atom_to_string(&decl.ident.sym);
        self.enter_scope(name, "class");
        decl.visit_children_with(self);
        self.exit_scope();
    }

    fn visit_class_method(&mut self, method: &ClassMethod) {
        if let PropName::Ident(ident) = &method.key {
            let name = atom_to_string(&ident.sym);
            self.enter_scope(name, "method");
            method.visit_children_with(self);
            self.exit_scope();
        } else {
            method.visit_children_with(self);
        }
    }

    fn visit_key_value_prop(&mut self, prop: &KeyValueProp) {
        let name = match &prop.key {
            PropName::Ident(ident) => Some(atom_to_string(&ident.sym)),
            PropName::Str(s) => Some(wtf8_to_string(&s.value)),
            _ => None,
        };

        if let Some(name) = name {
            self.enter_scope(name, "property");
            prop.visit_children_with(self);
            self.exit_scope();
        } else {
            prop.visit_children_with(self);
        }
    }

    fn visit_assign_expr(&mut self, expr: &AssignExpr) {
        // Handle CommonJS exports: exports.foo = ...
        if let Some(name) = get_commonjs_export_name(&expr.left) {
            self.enter_scope(name, "variable");
            expr.visit_children_with(self);
            self.exit_scope();
        } else {
            expr.visit_children_with(self);
        }
    }

    fn visit_call_expr(&mut self, call: &CallExpr) {
        if self.is_gql_definition_call(call) {
            let ast_path = self.register_definition();
            let is_top_level = self.scope_stack.len() <= 1;
            let export_binding = self.resolve_export_info(call);

            self.metadata.insert(
                call.span,
                GqlDefinitionMetadata {
                    ast_path,
                    is_top_level,
                    is_exported: export_binding.is_some(),
                    export_binding,
                },
            );

            // Don't visit children of GQL calls
            return;
        }

        call.visit_children_with(self);
    }
}

/// Check if an expression is a reference to `gql`.
fn is_gql_reference(expr: &Expr) -> bool {
    match expr {
        Expr::Ident(ident) => atom_eq(&ident.sym, "gql"),
        Expr::Member(member) => {
            if let MemberProp::Ident(ident) = &member.prop {
                if atom_eq(&ident.sym, "gql") {
                    return true;
                }
            }
            is_gql_reference(&member.obj)
        }
        _ => false,
    }
}

/// Get the export name from a CommonJS export pattern.
fn get_commonjs_export_name(target: &AssignTarget) -> Option<String> {
    match target {
        AssignTarget::Simple(SimpleAssignTarget::Member(member)) => {
            // Check for exports.foo or module.exports.foo
            let is_exports = matches!(&*member.obj, Expr::Ident(ident) if atom_eq(&ident.sym, "exports"));
            let is_module_exports = if let Expr::Member(inner) = &*member.obj {
                matches!(&*inner.obj, Expr::Ident(ident) if atom_eq(&ident.sym, "module"))
                    && matches!(&inner.prop, MemberProp::Ident(ident) if atom_eq(&ident.sym, "exports"))
            } else {
                false
            };

            if !is_exports && !is_module_exports {
                return None;
            }

            // Extract property name
            if let MemberProp::Ident(ident) = &member.prop {
                Some(atom_to_string(&ident.sym))
            } else {
                None
            }
        }
        _ => None,
    }
}

/// Helper to compare an Atom with a string.
fn atom_eq<T: AsRef<str>>(atom: &T, s: &str) -> bool {
    atom.as_ref() == s
}

/// Helper to convert an Atom to String.
fn atom_to_string<T: AsRef<str>>(atom: &T) -> String {
    atom.as_ref().to_string()
}

/// Helper to convert a Wtf8Atom (string literal value) to String.
fn wtf8_to_string(atom: &swc_core::atoms::Wtf8Atom) -> String {
    atom.to_string_lossy().into_owned()
}
