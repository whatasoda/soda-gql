//! Runtime call generation module.
//!
//! This module generates the `gqlRuntime.*` calls that replace `gql.default()` calls.

use swc_core::common::{SyntaxContext, DUMMY_SP};
use swc_core::ecma::ast::*;

use crate::types::{
    BuilderArtifactElement, InlineOperationPrebuild, ModelPrebuild, OperationPrebuild,
    SlicePrebuild,
};

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
    /// For models and slices: returns just the replacement expression.
    /// For operations: returns both a reference expression and a runtime setup statement.
    pub fn build_replacement(&self, replacement: &GqlReplacement) -> Option<(Expr, Option<Stmt>)> {
        match &replacement.artifact {
            BuilderArtifactElement::Model { prebuild, .. } => {
                self.build_model_call(prebuild, &replacement.builder_args)
                    .map(|expr| (expr, None))
            }
            BuilderArtifactElement::Slice { prebuild, .. } => {
                self.build_slice_call(prebuild, &replacement.builder_args)
                    .map(|expr| (expr, None))
            }
            BuilderArtifactElement::Operation { prebuild, .. } => {
                self.build_composed_operation_calls(prebuild, &replacement.builder_args)
            }
            BuilderArtifactElement::InlineOperation { prebuild, .. } => {
                self.build_inline_operation_calls(prebuild)
            }
        }
    }

    /// Create the runtime accessor expression.
    fn create_runtime_accessor(&self) -> Expr {
        if self.is_cjs {
            // __soda_gql_runtime.gqlRuntime
            Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(Expr::Ident(Ident::new(CJS_RUNTIME_NAME.into(), DUMMY_SP, Default::default()))),
                prop: MemberProp::Ident(IdentName::new(RUNTIME_IMPORT_NAME.into(), DUMMY_SP)),
            })
        } else {
            Expr::Ident(Ident::new(RUNTIME_IMPORT_NAME.into(), DUMMY_SP, Default::default()))
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

    /// Build a model runtime call.
    ///
    /// Input: `model.User({}, fields, normalize)`
    /// Output: `gqlRuntime.model({ prebuild: { typename: "User" }, runtime: { normalize } })`
    fn build_model_call(&self, prebuild: &ModelPrebuild, builder_args: &[ExprOrSpread]) -> Option<Expr> {
        // Get the normalize function (3rd argument)
        let normalize = builder_args.get(2)?.clone();

        let arg = self.create_object_lit(vec![
            (
                "prebuild",
                self.create_object_lit(vec![("typename", self.create_string_lit(&prebuild.typename))]),
            ),
            (
                "runtime",
                self.create_object_lit(vec![("normalize", (*normalize.expr).clone())]),
            ),
        ]);

        Some(self.create_runtime_call("model", vec![ExprOrSpread {
            spread: None,
            expr: Box::new(arg),
        }]))
    }

    /// Build a slice runtime call.
    ///
    /// Input: `query.slice({}, fields, projectionBuilder)`
    /// Output: `gqlRuntime.slice({ prebuild: { operationType: "query" }, runtime: { buildProjection } })`
    fn build_slice_call(&self, prebuild: &SlicePrebuild, builder_args: &[ExprOrSpread]) -> Option<Expr> {
        // Get the projection builder function (3rd argument)
        let projection_builder = builder_args.get(2)?.clone();

        let arg = self.create_object_lit(vec![
            (
                "prebuild",
                self.create_object_lit(vec![("operationType", self.create_string_lit(&prebuild.operation_type))]),
            ),
            (
                "runtime",
                self.create_object_lit(vec![("buildProjection", (*projection_builder.expr).clone())]),
            ),
        ]);

        Some(self.create_runtime_call("slice", vec![ExprOrSpread {
            spread: None,
            expr: Box::new(arg),
        }]))
    }

    /// Build composed operation runtime calls.
    ///
    /// Returns (reference_call, runtime_call) where:
    /// - runtime_call: `gqlRuntime.composedOperation({ prebuild: JSON.parse(...), runtime: { getSlices } })`
    /// - reference_call: `gqlRuntime.getComposedOperation("OperationName")`
    fn build_composed_operation_calls(
        &self,
        prebuild: &OperationPrebuild,
        builder_args: &[ExprOrSpread],
    ) -> Option<(Expr, Option<Stmt>)> {
        // Get the slices builder function (2nd argument)
        let slices_builder = builder_args.get(1)?.clone();

        // Build the runtime call
        let prebuild_json = serde_json::to_string(prebuild).ok()?;
        let runtime_call_expr = self.create_runtime_call(
            "composedOperation",
            vec![ExprOrSpread {
                spread: None,
                expr: Box::new(self.create_object_lit(vec![
                    ("prebuild", self.create_json_parse(&prebuild_json)),
                    (
                        "runtime",
                        self.create_object_lit(vec![("getSlices", (*slices_builder.expr).clone())]),
                    ),
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
            "getComposedOperation",
            vec![ExprOrSpread {
                spread: None,
                expr: Box::new(self.create_string_lit(&prebuild.operation_name)),
            }],
        );

        Some((reference_call, Some(runtime_stmt)))
    }

    /// Build inline operation runtime calls.
    ///
    /// Returns (reference_call, runtime_call) where:
    /// - runtime_call: `gqlRuntime.inlineOperation({ prebuild: JSON.parse(...), runtime: {} })`
    /// - reference_call: `gqlRuntime.getInlineOperation("OperationName")`
    fn build_inline_operation_calls(&self, prebuild: &InlineOperationPrebuild) -> Option<(Expr, Option<Stmt>)> {
        // Build the runtime call
        let prebuild_json = serde_json::to_string(prebuild).ok()?;
        let runtime_call_expr = self.create_runtime_call(
            "inlineOperation",
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
            "getInlineOperation",
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
                obj: Box::new(Expr::Ident(Ident::new("JSON".into(), DUMMY_SP, Default::default()))),
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
