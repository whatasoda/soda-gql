//! GQL call analysis module.
//!
//! This module is responsible for:
//! - Detecting `gql.default()` call patterns
//! - Extracting the inner builder call
//! - Mapping calls to their corresponding artifacts

use std::collections::HashMap;
use swc_core::common::Span;
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitWith};

use crate::types::{BuilderArtifact, BuilderArtifactElement, CanonicalId, PluginError};

use super::metadata::MetadataMap;

/// Information about a detected GQL call that needs to be transformed.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct GqlCallInfo {
    /// The canonical ID for this call
    pub canonical_id: CanonicalId,
    /// The artifact element from the builder
    pub artifact: BuilderArtifactElement,
    /// Span of the original gql.default() call
    pub call_span: Span,
    /// The inner builder call (e.g., fragment.User(), query.slice())
    pub builder_call_args: Vec<ExprOrSpread>,
}

/// Replacement information for a GQL call.
#[derive(Debug)]
pub struct GqlReplacement {
    #[allow(dead_code)]
    pub canonical_id: CanonicalId,
    pub artifact: BuilderArtifactElement,
    pub builder_args: Vec<ExprOrSpread>,
}

/// Finds GQL calls in the AST and prepares them for transformation.
pub struct GqlCallFinder<'a> {
    artifact: &'a BuilderArtifact,
    metadata: &'a MetadataMap,
    source_path: &'a str,
    /// Map from call span to replacement info
    replacements: HashMap<Span, GqlReplacement>,
    has_transforms: bool,
    /// Errors encountered during analysis
    errors: Vec<PluginError>,
}

impl<'a> GqlCallFinder<'a> {
    pub fn new(artifact: &'a BuilderArtifact, metadata: &'a MetadataMap, source_path: &'a str) -> Self {
        Self {
            artifact,
            metadata,
            source_path,
            replacements: HashMap::new(),
            has_transforms: false,
            errors: Vec::new(),
        }
    }

    /// Check if any transformations were found.
    pub fn has_transformations(&self) -> bool {
        self.has_transforms
    }

    /// Get the replacement for a call expression if it should be transformed.
    pub fn get_replacement(&self, call: &CallExpr) -> Option<&GqlReplacement> {
        self.replacements.get(&call.span)
    }

    /// Take collected errors.
    pub fn take_errors(&mut self) -> Vec<PluginError> {
        std::mem::take(&mut self.errors)
    }

    /// Process a potential GQL call expression.
    fn process_call(&mut self, call: &CallExpr) {
        // Check if this is a gql.default() or gql.* call
        if let Some(builder_call) = find_gql_builder_call(call) {
            // Get metadata for this call
            if let Some(meta) = self.metadata.get(&call.span) {
                let canonical_id = resolve_canonical_id(self.source_path, &meta.ast_path);

                // Look up the artifact
                if let Some(artifact) = self.artifact.get(&canonical_id) {
                    self.replacements.insert(
                        call.span,
                        GqlReplacement {
                            canonical_id,
                            artifact: artifact.clone(),
                            builder_args: builder_call.args.clone(),
                        },
                    );
                    self.has_transforms = true;
                } else {
                    let error = PluginError::artifact_not_found(self.source_path, &canonical_id);
                    eprintln!("[swc] {}", error.format());
                    self.errors.push(error);
                }
            } else {
                let error = PluginError::metadata_not_found(self.source_path);
                eprintln!("[swc] {}", error.format());
                self.errors.push(error);
            }
        }
    }
}

impl Visit for GqlCallFinder<'_> {
    fn visit_call_expr(&mut self, call: &CallExpr) {
        // First check this call
        self.process_call(call);

        // Then visit children
        call.visit_children_with(self);
    }
}

/// Find the inner builder call from a gql.default() call.
///
/// Supports both arrow functions and function expressions:
/// - `gql.default(({ fragment }) => fragment.User(...))`
/// - `gql.default(function({ fragment }) { return fragment.User(...); })`
///
/// Returns: The inner builder call expression (e.g., `fragment.User(...)`)
fn find_gql_builder_call(call: &CallExpr) -> Option<&CallExpr> {
    // Check if callee is gql.* pattern
    if !is_gql_member_expression(&call.callee) {
        return None;
    }

    // Should have exactly one argument
    if call.args.len() != 1 {
        return None;
    }

    // The argument should be an arrow function or function expression
    let arg = &call.args[0];
    if arg.spread.is_some() {
        return None;
    }

    match &*arg.expr {
        Expr::Arrow(arrow) => extract_builder_call_from_arrow(arrow),
        Expr::Fn(fn_expr) => extract_builder_call_from_fn(fn_expr),
        _ => None,
    }
}

/// Check if the callee is a gql.* member expression.
fn is_gql_member_expression(callee: &Callee) -> bool {
    match callee {
        Callee::Expr(expr) => {
            if let Expr::Member(member) = &**expr {
                is_gql_reference(&member.obj)
            } else {
                false
            }
        }
        _ => false,
    }
}

/// Recursively check if an expression is a reference to `gql`.
fn is_gql_reference(expr: &Expr) -> bool {
    match expr {
        Expr::Ident(ident) => atom_eq(&ident.sym, "gql"),
        Expr::Member(member) => {
            // Check if property is "gql"
            if let MemberProp::Ident(ident) = &member.prop {
                if atom_eq(&ident.sym, "gql") {
                    return true;
                }
            }
            // Recursively check the object
            is_gql_reference(&member.obj)
        }
        _ => false,
    }
}

/// Helper to compare an atom with a string.
fn atom_eq<T: AsRef<str>>(atom: &T, s: &str) -> bool {
    atom.as_ref() == s
}

/// Extract the builder call from an arrow function body.
fn extract_builder_call_from_arrow(arrow: &ArrowExpr) -> Option<&CallExpr> {
    match &*arrow.body {
        BlockStmtOrExpr::Expr(expr) => {
            if let Expr::Call(call) = &**expr {
                Some(call)
            } else {
                None
            }
        }
        BlockStmtOrExpr::BlockStmt(block) => extract_call_from_block(block),
    }
}

/// Extract the builder call from a function expression body.
fn extract_builder_call_from_fn(fn_expr: &FnExpr) -> Option<&CallExpr> {
    // Function body is Option<BlockStmt>
    fn_expr
        .function
        .body
        .as_ref()
        .and_then(|block| extract_call_from_block(block))
}

/// Extract a call expression from a block statement (shared by arrow and fn).
fn extract_call_from_block(block: &BlockStmt) -> Option<&CallExpr> {
    // Look for a return statement with a call expression
    for stmt in &block.stmts {
        if let Stmt::Return(ret) = stmt {
            if let Some(arg) = &ret.arg {
                if let Expr::Call(call) = &**arg {
                    return Some(call);
                }
            }
        }
    }
    None
}

/// Resolve a canonical ID from file path and AST path.
/// The canonical ID format is: {normalizedAbsPath}::{astPath}
///
/// This mirrors the TypeScript implementation in @soda-gql/common:
/// - Normalizes path separators to forward slashes (cross-platform)
/// - Format matches builder artifact keys exactly
fn resolve_canonical_id(file_path: &str, ast_path: &str) -> CanonicalId {
    // Normalize path separators to forward slashes for cross-platform compatibility
    // This matches the TypeScript normalizePath function behavior
    let normalized_path = file_path.replace('\\', "/");
    format!("{}::{}", normalized_path, ast_path)
}
