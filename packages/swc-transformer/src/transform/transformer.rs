//! Main transformation orchestration.
//!
//! This module coordinates the transformation process:
//! 1. Parse source with SWC parser
//! 2. Collect metadata (canonical IDs, export bindings)
//! 3. Visit AST and transform gql.default() calls
//! 4. Manage imports (add runtime, remove graphql-system)
//! 5. Insert runtime calls after imports
//! 6. Emit code with SWC codegen

use serde::{Deserialize, Serialize};
use swc_core::common::sync::Lrc;
use swc_core::common::{FileName, SourceMap};
use swc_core::ecma::ast::*;
use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter};
use swc_core::ecma::parser::{lexer::Lexer, Parser, Syntax, TsSyntax};
use swc_core::ecma::visit::{VisitMut, VisitMutWith, VisitWith};

use crate::types::{BuilderArtifact, TransformInput};

use super::analysis::GqlCallFinder;
use super::imports::ImportManager;
use super::metadata::MetadataCollector;
use super::runtime::RuntimeCallBuilder;

/// Result of a transformation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformResult {
    /// The transformed source code.
    pub output_code: String,

    /// Whether any transformation was performed.
    pub transformed: bool,
}

/// Transform a source file.
///
/// # Arguments
/// * `input` - The transformation input containing source, path, artifact, and config
///
/// # Returns
/// Result containing the transformed code, or an error message
pub fn transform_source(input: &TransformInput) -> Result<TransformResult, String> {
    // Parse the artifact
    let artifact: BuilderArtifact = serde_json::from_str(&input.artifact_json)
        .map_err(|e| format!("Failed to parse artifact: {}", e))?;

    // Create source map
    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(
        Lrc::new(FileName::Custom(input.source_path.clone())),
        input.source_code.clone(),
    );

    // Determine if this is a TSX file
    let is_tsx = input.source_path.ends_with(".tsx");

    // Create parser
    let lexer = Lexer::new(
        Syntax::Typescript(TsSyntax {
            tsx: is_tsx,
            ..Default::default()
        }),
        EsVersion::Es2022,
        (&*fm).into(),
        None,
    );

    let mut parser = Parser::new_from(lexer);
    let mut module = parser
        .parse_module()
        .map_err(|e| format!("Parse error: {:?}", e))?;

    // Collect metadata about GQL definitions
    let metadata = MetadataCollector::collect(&module, &input.source_path);

    // Find and analyze GQL calls
    let mut finder = GqlCallFinder::new(&artifact, &metadata, &input.source_path);
    module.visit_with(&mut finder);

    // If no GQL calls found, return unchanged
    if !finder.has_transformations() {
        return Ok(TransformResult {
            output_code: input.source_code.clone(),
            transformed: false,
        });
    }

    // Build runtime calls and transform
    let runtime_builder = RuntimeCallBuilder::new(input.config.is_cjs);
    let mut transformer = GqlTransformer::new(&finder, &runtime_builder);
    module.visit_mut_with(&mut transformer);

    // Manage imports
    let mut import_manager = ImportManager::new(
        transformer.needs_runtime_import(),
        input.config.is_cjs,
        &input.config.graphql_system_aliases,
    );
    module.visit_mut_with(&mut import_manager);

    // Insert runtime calls after imports
    if !transformer.runtime_calls.is_empty() {
        insert_runtime_calls(&mut module, std::mem::take(&mut transformer.runtime_calls));
    }

    // Emit the transformed code
    let output = emit_module(&cm, &module)?;

    Ok(TransformResult {
        output_code: output,
        transformed: true,
    })
}

/// Main AST transformer that replaces gql.default() calls with runtime calls.
struct GqlTransformer<'a> {
    finder: &'a GqlCallFinder<'a>,
    runtime_builder: &'a RuntimeCallBuilder,
    needs_runtime: bool,
    pub runtime_calls: Vec<Stmt>,
}

impl<'a> GqlTransformer<'a> {
    fn new(finder: &'a GqlCallFinder<'a>, runtime_builder: &'a RuntimeCallBuilder) -> Self {
        Self {
            finder,
            runtime_builder,
            needs_runtime: false,
            runtime_calls: Vec::new(),
        }
    }

    fn needs_runtime_import(&self) -> bool {
        self.needs_runtime
    }
}

impl VisitMut for GqlTransformer<'_> {
    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        // First visit children
        expr.visit_mut_children_with(self);

        // Check if this is a GQL call that should be transformed
        if let Expr::Call(call) = expr {
            if let Some(replacement) = self.finder.get_replacement(call) {
                // Mark that we need the runtime import
                self.needs_runtime = true;

                // Build the replacement expression
                if let Some((reference_expr, runtime_stmt)) =
                    self.runtime_builder.build_replacement(replacement)
                {
                    // Store the runtime statement to be inserted later
                    if let Some(stmt) = runtime_stmt {
                        self.runtime_calls.push(stmt);
                    }

                    // Replace the expression
                    *expr = reference_expr;
                }
            }
        }
    }
}

/// Insert runtime calls after the last import statement.
fn insert_runtime_calls(module: &mut Module, calls: Vec<Stmt>) {
    if calls.is_empty() {
        return;
    }

    // Find the position after the last import
    let mut insert_pos = 0;
    for (i, item) in module.body.iter().enumerate() {
        if matches!(item, ModuleItem::ModuleDecl(ModuleDecl::Import(_))) {
            insert_pos = i + 1;
        }
    }

    // Insert runtime calls
    let items: Vec<ModuleItem> = calls.into_iter().map(ModuleItem::Stmt).collect();
    module.body.splice(insert_pos..insert_pos, items);
}

/// Emit the module as JavaScript code.
fn emit_module(cm: &Lrc<SourceMap>, module: &Module) -> Result<String, String> {
    let mut buf = vec![];
    {
        let writer = JsWriter::new(cm.clone(), "\n", &mut buf, None);
        let mut emitter = Emitter {
            cfg: swc_core::ecma::codegen::Config::default().with_minify(false),
            cm: cm.clone(),
            comments: None,
            wr: writer,
        };

        emitter
            .emit_module(module)
            .map_err(|e| format!("Emit error: {:?}", e))?;
    }

    String::from_utf8(buf).map_err(|e| format!("UTF-8 error: {}", e))
}
