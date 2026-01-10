//! Runtime call generation module.
//!
//! This module generates the `gqlRuntime.*` calls that replace `gql.default()` calls.

use swc_core::common::{SyntaxContext, DUMMY_SP};
use swc_core::ecma::ast::*;

use crate::types::{BuilderArtifactElement, FragmentPrebuild, OperationPrebuild};

use super::analysis::GqlReplacement;

const RUNTIME_IMPORT_NAME: &str = "gqlRuntime";
const CJS_RUNTIME_NAME: &str = "__soda_gql_runtime";

/// Builds runtime calls for GQL transformations.
pub struct RuntimeCallBuilder {
    is_cjs: bool,
}

impl RuntimeCallBuilder {
    pub fn new(is_cjs: bool) -> Self {
        Self { is_cjs }
    }

    /// Build replacement expression and optional runtime statement.
    ///
    /// For fragments: returns just the replacement expression.
    /// For operations: returns both a reference expression and a runtime setup statement.
    pub fn build_replacement(&self, replacement: &GqlReplacement) -> Option<(Expr, Option<Stmt>)> {
        let result = match &replacement.artifact {
            BuilderArtifactElement::Fragment { prebuild, .. } => self
                .build_fragment_call(prebuild, &replacement.builder_args)
                .map(|expr| (expr, None)),
            BuilderArtifactElement::Operation { prebuild, .. } => {
                self.build_operation_calls(prebuild)
            }
        };

        if result.is_none() {
            let artifact_type = match &replacement.artifact {
                BuilderArtifactElement::Fragment { .. } => "Fragment",
                BuilderArtifactElement::Operation { .. } => "Operation",
            };
            eprintln!(
                "[swc] Warning: Failed to build replacement for {} artifact (canonical ID: '{}'). \
                This may indicate missing or mismatched builder arguments.",
                artifact_type, replacement.canonical_id
            );
        }

        result
    }

    /// Create the runtime accessor expression.
    fn create_runtime_accessor(&self) -> Expr {
        if self.is_cjs {
            // __soda_gql_runtime.gqlRuntime
            Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(Expr::Ident(Ident::new(
                    CJS_RUNTIME_NAME.into(),
                    DUMMY_SP,
                    Default::default(),
                ))),
                prop: MemberProp::Ident(IdentName::new(RUNTIME_IMPORT_NAME.into(), DUMMY_SP)),
            })
        } else {
            Expr::Ident(Ident::new(
                RUNTIME_IMPORT_NAME.into(),
                DUMMY_SP,
                Default::default(),
            ))
        }
    }

    /// Create a runtime method call.
    fn create_runtime_call(&self, method: &str, args: Vec<ExprOrSpread>) -> Expr {
        Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(self.create_runtime_accessor()),
                prop: MemberProp::Ident(IdentName::new(method.into(), DUMMY_SP)),
            }))),
            args,
            type_args: None,
        })
    }

    /// Build a fragment runtime call.
    ///
    /// Input: `fragment.User({}, fields)`
    /// Output: `gqlRuntime.fragment({ prebuild: { typename: "User" } })`
    fn build_fragment_call(
        &self,
        prebuild: &FragmentPrebuild,
        _builder_args: &[ExprOrSpread],
    ) -> Option<Expr> {
        let arg = self.create_object_lit(vec![(
            "prebuild",
            self.create_object_lit(vec![("typename", self.create_string_lit(&prebuild.typename))]),
        )]);

        Some(self.create_runtime_call(
            "fragment",
            vec![ExprOrSpread {
                spread: None,
                expr: Box::new(arg),
            }],
        ))
    }

    /// Build operation runtime calls.
    ///
    /// Returns (reference_call, runtime_call) where:
    /// - runtime_call: `gqlRuntime.operation({ prebuild: JSON.parse(...), runtime: {} })`
    /// - reference_call: `gqlRuntime.getOperation("OperationName")`
    fn build_operation_calls(&self, prebuild: &OperationPrebuild) -> Option<(Expr, Option<Stmt>)> {
        // Build the runtime call
        let prebuild_json = serde_json::to_string(prebuild).ok()?;
        let runtime_call_expr = self.create_runtime_call(
            "operation",
            vec![ExprOrSpread {
                spread: None,
                expr: Box::new(self.create_object_lit(vec![
                    ("prebuild", self.create_json_parse(&prebuild_json)),
                    ("runtime", self.create_object_lit(vec![])),
                ])),
            }],
        );

        // Wrap in an expression statement
        let runtime_stmt = Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(runtime_call_expr),
        });

        // Build the reference call
        let reference_call = self.create_runtime_call(
            "getOperation",
            vec![ExprOrSpread {
                spread: None,
                expr: Box::new(self.create_string_lit(&prebuild.operation_name)),
            }],
        );

        Some((reference_call, Some(runtime_stmt)))
    }

    /// Create an object literal expression.
    fn create_object_lit(&self, props: Vec<(&str, Expr)>) -> Expr {
        Expr::Object(ObjectLit {
            span: DUMMY_SP,
            props: props
                .into_iter()
                .map(|(key, value)| {
                    PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                        key: PropName::Ident(IdentName::new(key.into(), DUMMY_SP)),
                        value: Box::new(value),
                    })))
                })
                .collect(),
        })
    }

    /// Create a string literal expression.
    fn create_string_lit(&self, value: &str) -> Expr {
        Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: value.into(),
            raw: None,
        }))
    }

    /// Create a JSON.parse() call expression.
    fn create_json_parse(&self, json: &str) -> Expr {
        Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(Expr::Ident(Ident::new(
                    "JSON".into(),
                    DUMMY_SP,
                    Default::default(),
                ))),
                prop: MemberProp::Ident(IdentName::new("parse".into(), DUMMY_SP)),
            }))),
            args: vec![ExprOrSpread {
                spread: None,
                expr: Box::new(self.create_string_lit(json)),
            }],
            type_args: None,
        })
    }
}
